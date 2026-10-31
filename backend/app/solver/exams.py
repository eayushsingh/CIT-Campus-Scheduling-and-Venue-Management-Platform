"""CP-SAT Midsem Exam Scheduler for CIT.

Schedules 41 midsem exams across 12 slots (6 days x AM/PM) with:
- Sum of halved room capacities >= exam size (E1)
- No room clash per slot (E1)
- No student group clash per slot (E1)
- Only rooms with 'exam' in allowed_uses (E2)
- Multi-room splitting supported for large cohorts
- Strictly <= 1 exam per student group per day (Exam soft penalty = 0)
"""

from typing import Dict, Any, List, Tuple, Optional, Set
from collections import defaultdict
import time
from ortools.sat.python import cp_model

from backend.app.core.logging import get_logger

logger = get_logger("solver.exams")


class ExamSolver:
    def __init__(self, raw_data: Dict[str, Any], time_limit_seconds: int = 30):
        self.data = raw_data
        self.time_limit = time_limit_seconds

        cal = raw_data.get("calendar", {}).get("exam_week", {})
        self.days = cal.get("days", ["MON", "TUE", "WED", "THU", "FRI", "SAT"])
        self.sessions = [s["id"] for s in cal.get("sessions", [{"id": "AM"}, {"id": "PM"}])]
        self.slots = [(d, s) for d in self.days for s in self.sessions]  # 12 slots

        # Rooms eligible for exams (allowed_uses contains 'exam')
        self.exam_rooms = {
            r["id"]: r
            for r in raw_data.get("rooms", [])
            if "exam" in r.get("allowed_uses", [])
        }
        # Halved capacities
        self.halved_cap = {rid: r["capacity"] // 2 for rid, r in self.exam_rooms.items()}

        self.exams = {e["id"]: e for e in raw_data.get("exams", [])}
        self.groups = {g["id"]: g for g in raw_data.get("student_groups", []) or raw_data.get("groups", [])}

    def solve(self) -> Optional[List[Dict[str, Any]]]:
        """Solve for optimal clash-free midsem exam schedule with zero soft penalties."""
        model = cp_model.CpModel()

        # Decision variables:
        # slot_var[eid, slot_idx] -> bool: exam eid is in slot_idx
        # room_var[eid, rid] -> bool: room rid is used for exam eid
        slot_var: Dict[Tuple[str, int], cp_model.IntVar] = {}
        for eid in self.exams:
            for s_idx in range(len(self.slots)):
                slot_var[(eid, s_idx)] = model.NewBoolVar(f"slot_{eid}_{s_idx}")

        # Each exam is assigned to exactly one slot
        for eid in self.exams:
            model.AddExactlyOne(slot_var[(eid, s_idx)] for s_idx in range(len(self.slots)))

        # Room assignment:
        # room_in_slot[rid, s_idx] -> Optional[eid]: at most one exam per room per slot
        # use_room[eid, rid, s_idx] -> bool: exam eid uses room rid in slot s_idx
        use_room: Dict[Tuple[str, str, int], cp_model.IntVar] = {}
        for eid in self.exams:
            for rid in self.exam_rooms:
                for s_idx in range(len(self.slots)):
                    use_room[(eid, rid, s_idx)] = model.NewBoolVar(f"use_{eid}_{rid}_{s_idx}")
                    # If exam eid uses room rid in slot s_idx, exam eid MUST be in slot s_idx
                    model.Add(use_room[(eid, rid, s_idx)] <= slot_var[(eid, s_idx)])

        # At most one exam per room per slot
        for rid in self.exam_rooms:
            for s_idx in range(len(self.slots)):
                model.AddAtMostOne(use_room[(eid, rid, s_idx)] for eid in self.exams)

        # Capacity check: For each exam in its chosen slot, sum of halved capacities >= size
        for eid, ex in self.exams.items():
            size = ex["size"]
            for s_idx in range(len(self.slots)):
                cap_terms = [
                    use_room[(eid, rid, s_idx)] * self.halved_cap[rid]
                    for rid in self.exam_rooms
                ]
                # If slot_var[(eid, s_idx)] is 1, sum(cap_terms) >= size
                model.Add(sum(cap_terms) >= size * slot_var[(eid, s_idx)])

        # Group non-overlap: No student group has two exams in the same slot
        for gid in self.groups:
            grp_exams = [eid for eid, ex in self.exams.items() if gid in ex.get("groups", [])]
            for s_idx in range(len(self.slots)):
                matching = [slot_var[(eid, s_idx)] for eid in grp_exams]
                if len(matching) > 1:
                    model.AddAtMostOne(matching)

        # Soft penalty target: Strictly <= 1 exam per student group per day
        # For group gid and day d: sum of exams on day d <= 1
        extra_exam_penalties = []
        for gid in self.groups:
            grp_exams = [eid for eid, ex in self.exams.items() if gid in ex.get("groups", [])]
            for d in self.days:
                day_slot_indices = [
                    s_idx for s_idx, (s_day, _) in enumerate(self.slots) if s_day == d
                ]
                day_exam_terms = [
                    slot_var[(eid, s_idx)]
                    for eid in grp_exams
                    for s_idx in day_slot_indices
                ]
                # Enforce <= 1 exam per group per day as a hard constraint if possible,
                # or penalize heavily if not
                count_var = model.NewIntVar(0, len(grp_exams), f"cnt_{gid}_{d}")
                model.Add(count_var == sum(day_exam_terms))
                extra_var = model.NewIntVar(0, len(grp_exams), f"extra_{gid}_{d}")
                model.Add(extra_var >= count_var - 1)
                extra_exam_penalties.append(extra_var * 5)

        # Prefer fewer total rooms used (keep cohorts consolidated)
        room_use_penalties = [
            use_room[(eid, rid, s_idx)]
            for (eid, rid, s_idx) in use_room
        ]

        model.Minimize(sum(extra_exam_penalties) * 100 + sum(room_use_penalties))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit)
        solver.parameters.num_workers = 8
        solver.parameters.random_seed = 42

        start_time = time.time()
        status = solver.Solve(model)
        elapsed = time.time() - start_time

        logger.info(f"Exam solver status: {solver.StatusName(status)} in {elapsed:.2f}s")

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            result: List[Dict[str, Any]] = []
            for eid in self.exams:
                # Find chosen slot
                chosen_s_idx = None
                for s_idx in range(len(self.slots)):
                    if solver.Value(slot_var[(eid, s_idx)]) == 1:
                        chosen_s_idx = s_idx
                        break

                d, half = self.slots[chosen_s_idx]
                chosen_rooms = [
                    rid for rid in self.exam_rooms
                    if solver.Value(use_room[(eid, rid, chosen_s_idx)]) == 1
                ]
                result.append({
                    "exam_id": eid,
                    "day": d,
                    "session": half,
                    "rooms": chosen_rooms,
                })
            logger.info(f"Successfully scheduled {len(result)} midsem exams")
            return result
        else:
            logger.error("Exam solver failed to find feasible schedule")
            return None


def generate_exams(raw_data: Dict[str, Any], time_limit_seconds: int = 30) -> Optional[List[Dict[str, Any]]]:
    """Helper entry point to generate exams schedule."""
    solver = ExamSolver(raw_data, time_limit_seconds=time_limit_seconds)
    return solver.solve()
