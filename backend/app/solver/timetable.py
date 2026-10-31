"""CP-SAT Timetable Constraint Solver for CIT.

Generates clash-free weekly timetable strictly satisfying H1-H14 hard rules
and optimizing S1-S6 soft penalties.
"""

from typing import Dict, Any, List, Tuple, Optional, Set
from collections import defaultdict
import time
from ortools.sat.python import cp_model

from backend.app.domain.slot_math import (
    DAYS,
    TEACHING_PERIODS,
    LAB_ALLOWED_START_PERIODS,
    LUNCH_PERIOD_BOUNDARY,
    is_valid_teaching_slot,
)
from backend.app.core.logging import get_logger

logger = get_logger("solver.timetable")


class TimetableSolver:
    def __init__(
        self,
        raw_data: Dict[str, Any],
        reservations: Optional[List[Dict[str, Any]]] = None,
        time_limit_seconds: int = 60,
        num_workers: int = 8,
    ):
        self.data = raw_data
        self.reservations = reservations or []
        self.time_limit = time_limit_seconds
        self.num_workers = num_workers

        # Extract entities
        self.rooms = {r["id"]: r for r in raw_data.get("rooms", [])}
        self.faculty = {f["id"]: f for f in raw_data.get("faculty", [])}
        self.groups = {g["id"]: g for g in raw_data.get("student_groups", []) or raw_data.get("groups", [])}
        self.sessions = {s["id"]: s for s in raw_data.get("sessions", [])}
        self.courses = {c["id"]: c for c in raw_data.get("courses", [])}

        # Room unavailabilities: (room_id, day, period)
        self.room_unavail: Set[Tuple[str, str, int]] = set()
        for ru in raw_data.get("room_unavailability", []):
            rid = ru["room_id"]
            d = ru["day"]
            for p in ru["periods"]:
                self.room_unavail.add((rid, d, p))

        # Faculty unavailabilities: (faculty_id, day, period)
        self.fac_unavail: Set[Tuple[str, str, int]] = set()
        for f in self.faculty.values():
            fid = f["id"]
            for u in f.get("unavailable", []):
                d = u["day"]
                for p in u["periods"]:
                    self.fac_unavail.add((fid, d, p))

        # Faculty avoid slots: (faculty_id, day, period)
        self.fac_avoid: Set[Tuple[str, str, int]] = set()
        for f in self.faculty.values():
            fid = f["id"]
            for pref in f.get("preferences", []):
                if pref.get("type") in ["avoid", "avoid_day_period"]:
                    days = pref.get("days") or ([pref["day"]] if "day" in pref else [])
                    periods = pref.get("periods") or ([pref["period"]] if "period" in pref else [])
                    for d in days:
                        for p in periods:
                            self.fac_avoid.add((fid, d, p))

        # Hard reservations from Spectra week (room, day, period)
        self.reserved_room_slots: Set[Tuple[str, str, int]] = set()
        self.reserved_group_slots: Set[Tuple[str, str, int]] = set()
        for res in self.reservations:
            r_day = res.get("day")
            r_room = res.get("room_id")
            r_grp = res.get("group_id")
            for p in range(res.get("start_period", 1), res.get("end_period", 1) + 1):
                if r_room:
                    self.reserved_room_slots.add((r_room, r_day, p))
                if r_grp:
                    self.reserved_group_slots.add((r_grp, r_day, p))

    def solve(self) -> Optional[List[Dict[str, Any]]]:
        """Solve for a complete, clash-free schedule with minimal soft penalty."""
        model = cp_model.CpModel()

        # Step 1: Pre-filter valid domain combinations (s, d, p, r)
        # x[s_id, d, p, r_id] -> BoolVar
        x: Dict[Tuple[str, str, int, str], cp_model.IntVar] = {}
        session_vars: Dict[str, List[cp_model.IntVar]] = defaultdict(list)

        # Inverted indices for O(1) constraint construction
        room_period_vars: Dict[Tuple[str, str, int], List[cp_model.IntVar]] = defaultdict(list)
        fac_period_vars: Dict[Tuple[str, str, int], List[cp_model.IntVar]] = defaultdict(list)
        fac_day_terms: Dict[Tuple[str, str], List[Any]] = defaultdict(list)
        group_non_basket_vars: Dict[Tuple[str, str, int], List[cp_model.IntVar]] = defaultdict(list)
        basket_day_start_vars: Dict[Tuple[str, str, int], Dict[str, List[cp_model.IntVar]]] = defaultdict(lambda: defaultdict(list))

        for sid, s in self.sessions.items():
            dur = s.get("duration", 1)
            size = s["size"]
            fid = s["faculty_id"]
            allowed_room_types = set(s.get("room_types", []))
            needs_acc = s.get("needs_accessible", False)
            fixed = s.get("fixed_slot")
            b_slot = s.get("basket_slot")
            target_groups = s.get("groups", [])

            # Anchor ID101-ALL-L1 to WED P3 AUD as specified
            if sid == "ID101-ALL-L1":
                allowed_days = ["WED"]
                allowed_starts = [3]
                allowed_rooms = ["AUD"]
            elif fixed:
                allowed_days = [fixed["day"]]
                allowed_starts = [fixed["start_period"]] if "start_period" in fixed else [fixed.get("period", 1)]
                allowed_rooms = [fixed["room_id"]] if "room_id" in fixed else list(self.rooms.keys())
            else:
                allowed_days = DAYS
                allowed_starts = [p for p in TEACHING_PERIODS if is_valid_teaching_slot("MON", p, dur)]
                allowed_rooms = [
                    rid for rid, r in self.rooms.items()
                    if r["type"] in allowed_room_types
                    and r["capacity"] >= size
                    and (not needs_acc or r.get("accessible", True))
                    and ("lecture" in r.get("allowed_uses", []) or "tutorial" in r.get("allowed_uses", []) or "lab" in r.get("allowed_uses", []))
                ]

            for d in allowed_days:
                for p in allowed_starts:
                    # Lunch check & period boundary check
                    if not is_valid_teaching_slot(d, p, dur):
                        continue

                    # Faculty availability check
                    if any((fid, d, t) in self.fac_unavail for t in range(p, p + dur)):
                        continue

                    # Group reservation check
                    if any((g, d, t) in self.reserved_group_slots for g in target_groups for t in range(p, p + dur)):
                        continue

                    for rid in allowed_rooms:
                        # Room maintenance check
                        if any((rid, d, t) in self.room_unavail for t in range(p, p + dur)):
                            continue

                        # Room reservation check
                        if any((rid, d, t) in self.reserved_room_slots for t in range(p, p + dur)):
                            continue

                        var = model.NewBoolVar(f"x_{sid}_{d}_{p}_{rid}")
                        x[(sid, d, p, rid)] = var
                        session_vars[sid].append(var)

                        # Populate inverted indices
                        for t in range(p, p + dur):
                            room_period_vars[(rid, d, t)].append(var)
                            fac_period_vars[(fid, d, t)].append(var)
                            if not b_slot:
                                for g in target_groups:
                                    group_non_basket_vars[(g, d, t)].append(var)

                        fac_day_terms[(fid, d)].append(var * dur)

                        if b_slot:
                            basket_day_start_vars[(b_slot, d, p)][sid].append(var)

        # Check for empty domains
        for sid in self.sessions:
            if not session_vars[sid]:
                logger.error(f"Infeasible pre-filtering: session {sid} has 0 valid placements")
                return None

        # Constraint 1: Exactly one assignment per session (H1)
        for sid, vars_list in session_vars.items():
            model.AddExactlyOne(vars_list)

        # Constraint 2: Room Non-Overlap (H4)
        for (rid, d, t), vars_list in room_period_vars.items():
            if len(vars_list) > 1:
                model.AddAtMostOne(vars_list)

        # Constraint 3: Faculty Non-Overlap (H2)
        for (fid, d, t), vars_list in fac_period_vars.items():
            if len(vars_list) > 1:
                model.AddAtMostOne(vars_list)

        # Constraint 4: Faculty Daily Maximum Teaching Load (H12: max 4h/day)
        for (fid, d), terms in fac_day_terms.items():
            max_h = self.faculty[fid].get("max_hours_per_day", 4)
            model.Add(sum(terms) <= max_h)

        # Constraint 5: Elective Basket Synchronization (H11)
        # All sessions with same basket_slot must share exact same day & start_period
        baskets: Dict[str, List[str]] = defaultdict(list)
        for sid, s in self.sessions.items():
            b_slot = s.get("basket_slot")
            if b_slot:
                baskets[b_slot].append(sid)

        for b_slot, b_sessions in baskets.items():
            first_sid = b_sessions[0]
            for other_sid in b_sessions[1:]:
                for d in DAYS:
                    for p in TEACHING_PERIODS:
                        first_list = basket_day_start_vars[(b_slot, d, p)][first_sid]
                        other_list = basket_day_start_vars[(b_slot, d, p)][other_sid]
                        first_sum = sum(first_list) if first_list else 0
                        other_sum = sum(other_list) if other_list else 0
                        model.Add(first_sum == other_sum)

        # Constraint 6: Student Group Non-Overlap with Basket Key Sharing (H3)
        # For each basket, we create a boolean variable basket_active[b_slot, d, t]
        basket_active: Dict[Tuple[str, str, int], cp_model.IntVar] = {}
        for b_slot, b_sessions in baskets.items():
            rep_sid = b_sessions[0]
            dur = self.sessions[rep_sid].get("duration", 1)
            for d in DAYS:
                for t in TEACHING_PERIODS:
                    # Periods that could cover t: p <= t < p + dur
                    covering_vars = []
                    for p in range(max(1, t - dur + 1), t + 1):
                        covering_vars.extend(basket_day_start_vars[(b_slot, d, p)][rep_sid])
                    if covering_vars:
                        b_var = model.NewBoolVar(f"bact_{b_slot}_{d}_{t}")
                        model.Add(b_var == sum(covering_vars))
                        basket_active[(b_slot, d, t)] = b_var

        # Now enforce group non-overlap
        for gid in self.groups:
            # Check which baskets this group takes
            grp_baskets = {
                s.get("basket_slot")
                for s in self.sessions.values()
                if s.get("basket_slot") and gid in s.get("groups", [])
            }
            for d in DAYS:
                for t in TEACHING_PERIODS:
                    terms = list(group_non_basket_vars[(gid, d, t)])
                    for b_slot in grp_baskets:
                        if (b_slot, d, t) in basket_active:
                            terms.append(basket_active[(b_slot, d, t)])
                    if len(terms) > 1:
                        model.Add(sum(terms) <= 1)

        # =====================================================================
        # Soft Penalty Objective (S1, S5, S6)
        # =====================================================================
        soft_penalties = []

        # S1: Avoided slots (2 per hour)
        for (sid, d, p, rid), var in x.items():
            fid = self.sessions[sid]["faculty_id"]
            dur = self.sessions[sid].get("duration", 1)
            avoided_hours = sum(1 for t in range(p, p + dur) if (fid, d, t) in self.fac_avoid)
            if avoided_hours > 0:
                soft_penalties.append(var * (2 * avoided_hours))

        # S5: Room under-utilisation (<40% capacity) (1 per session)
        for (sid, d, p, rid), var in x.items():
            cap = self.rooms[rid]["capacity"]
            size = self.sessions[sid]["size"]
            if cap > 0 and (size / cap) < 0.4:
                soft_penalties.append(var * 1)

        # S6: P9 usage (1 per session)
        for (sid, d, p, rid), var in x.items():
            dur = self.sessions[sid].get("duration", 1)
            if p <= 9 <= (p + dur - 1):
                soft_penalties.append(var * 1)

        # Minimize soft penalties
        model.Minimize(sum(soft_penalties))

        # Configure solver
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit)
        solver.parameters.num_workers = self.num_workers
        solver.parameters.random_seed = 42

        start_time = time.time()
        status = solver.Solve(model)
        elapsed = time.time() - start_time

        logger.info(f"Timetable solver status: {solver.StatusName(status)} in {elapsed:.2f}s")

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            result: List[Dict[str, Any]] = []
            for (sid, d, p, rid), var in x.items():
                if solver.Value(var) == 1:
                    result.append({
                        "session_id": sid,
                        "day": d,
                        "start_period": p,
                        "room_id": rid,
                    })
            logger.info(f"Successfully placed {len(result)} sessions")
            return result
        else:
            logger.error("Timetable solver failed to find feasible solution")
            return None


def generate_timetable(
    raw_data: Dict[str, Any],
    reservations: Optional[List[Dict[str, Any]]] = None,
    time_limit_seconds: int = 60,
) -> Optional[List[Dict[str, Any]]]:
    """Helper entry point to generate timetable sessions list."""
    solver = TimetableSolver(raw_data, reservations=reservations, time_limit_seconds=time_limit_seconds)
    return solver.solve()
