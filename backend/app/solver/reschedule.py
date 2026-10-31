"""Minimal-Move Rescheduler for CIT Platform.

Re-schedules timetable after disruptions with a lexicographic objective:
(1) 0 Hard Violations (Feasibility)
(2) Minimise Count of Moved Sessions (10000x multiplier)
(3) Minimise Soft Penalty
"""

from typing import Dict, Any, List, Tuple, Optional, Set
from collections import defaultdict
import time
import copy
from ortools.sat.python import cp_model

from backend.app.domain.slot_math import (
    DAYS,
    TEACHING_PERIODS,
    LAB_ALLOWED_START_PERIODS,
    LUNCH_PERIOD_BOUNDARY,
    is_valid_teaching_slot,
)
from backend.app.validation.official_validator import run_official_validator
from backend.app.core.logging import get_logger

logger = get_logger("solver.reschedule")


def apply_disruption_to_data(data: Dict[str, Any], disruption: Dict[str, Any]) -> Dict[str, Any]:
    """Apply disruption changes with official validator semantics (permanent)."""
    d = copy.deepcopy(data)
    fac = {f["id"]: f for f in d.get("faculty", [])}

    for ch in disruption.get("changes", []):
        t = ch["type"]
        if t == "faculty_unavailable":
            fid = ch["faculty_id"]
            if fid in fac:
                for day in ch["days"]:
                    fac[fid].setdefault("unavailable", []).append({
                        "day": day,
                        "periods": ch["periods"],
                        "reason": ch.get("reason", ""),
                    })
        elif t == "room_unavailable":
            for day in ch["days"]:
                d.setdefault("room_unavailability", []).append({
                    "room_id": ch["room_id"],
                    "day": day,
                    "periods": ch["periods"],
                    "reason": ch.get("reason", ""),
                })
        elif t == "add_faculty":
            d.setdefault("faculty", []).append(ch["faculty"])
            fac[ch["faculty"]["id"]] = ch["faculty"]
        elif t == "add_session":
            d.setdefault("sessions", []).append(ch["session"])
        elif t == "remove_session":
            d["sessions"] = [s for s in d.get("sessions", []) if s["id"] != ch["session_id"]]
        else:
            logger.warning(f"Unknown disruption change type: {t}")

    return d


class Rescheduler:
    def __init__(
        self,
        base_data: Dict[str, Any],
        base_schedule: Dict[str, Any],
        disruption: Dict[str, Any],
        time_limit_seconds: int = 30,
    ):
        self.base_data = base_data
        self.base_schedule = base_schedule
        self.disruption = disruption
        self.time_limit = time_limit_seconds

        # Disrupted data
        self.data = apply_disruption_to_data(base_data, disruption)

        # Baseline assignment map: sid -> (day, start_period, room_id)
        self.baseline_assign: Dict[str, Tuple[str, int, str]] = {}
        for s in base_schedule.get("sessions", []):
            self.baseline_assign[s["session_id"]] = (s["day"], s["start_period"], s["room_id"])

        self.rooms = {r["id"]: r for r in self.data.get("rooms", [])}
        self.faculty = {f["id"]: f for f in self.data.get("faculty", [])}
        self.groups = {g["id"]: g for g in self.data.get("student_groups", []) or self.data.get("groups", [])}
        self.sessions = {s["id"]: s for s in self.data.get("sessions", [])}

        # Room unavailabilities
        self.room_unavail: Set[Tuple[str, str, int]] = set()
        for ru in self.data.get("room_unavailability", []):
            rid = ru["room_id"]
            d = ru["day"]
            for p in ru["periods"]:
                self.room_unavail.add((rid, d, p))

        # Faculty unavailabilities
        self.fac_unavail: Set[Tuple[str, str, int]] = set()
        for f in self.faculty.values():
            fid = f["id"]
            for u in f.get("unavailable", []):
                d = u["day"]
                for p in u["periods"]:
                    self.fac_unavail.add((fid, d, p))

        # Faculty avoid preferences
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

        # Approved bookings to protect
        self.approved_booking_slots: Set[Tuple[str, str, int]] = set()
        for b in base_schedule.get("fest_week", {}).get("bookings", []):
            if b.get("status") == "approved" and b.get("assigned_room") and b.get("assigned_day"):
                rid = b["assigned_room"]
                d = b["assigned_day"]
                for p in range(b.get("start_period", 1), b.get("end_period", 1) + 1):
                    self.approved_booking_slots.add((rid, d, p))

    def re_solve(self) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
        """Re-solve schedule minimizing moved sessions, returning (schedule_after, diff_summary)."""
        model = cp_model.CpModel()

        x: Dict[Tuple[str, str, int, str], cp_model.IntVar] = {}
        session_vars: Dict[str, List[cp_model.IntVar]] = defaultdict(list)

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
                    if not is_valid_teaching_slot(d, p, dur):
                        continue
                    if any((fid, d, t) in self.fac_unavail for t in range(p, p + dur)):
                        continue

                    for rid in allowed_rooms:
                        if any((rid, d, t) in self.room_unavail for t in range(p, p + dur)):
                            continue
                        if any((rid, d, t) in self.approved_booking_slots for t in range(p, p + dur)):
                            continue

                        var = model.NewBoolVar(f"x_{sid}_{d}_{p}_{rid}")
                        x[(sid, d, p, rid)] = var
                        session_vars[sid].append(var)

                        for t in range(p, p + dur):
                            room_period_vars[(rid, d, t)].append(var)
                            fac_period_vars[(fid, d, t)].append(var)
                            if not b_slot:
                                for g in target_groups:
                                    group_non_basket_vars[(g, d, t)].append(var)

                        fac_day_terms[(fid, d)].append(var * dur)

                        if b_slot:
                            basket_day_start_vars[(b_slot, d, p)][sid].append(var)

        # Check empty domains
        for sid in self.sessions:
            if not session_vars[sid]:
                reason = f"Session {sid} cannot be placed: no valid slots after disruption."
                logger.error(reason)
                return None, {"error": reason}

        # Constraint 1: Exactly one assignment per session
        for sid, vars_list in session_vars.items():
            model.AddExactlyOne(vars_list)

        # Constraint 2: Room Non-Overlap
        for (rid, d, t), vars_list in room_period_vars.items():
            if len(vars_list) > 1:
                model.AddAtMostOne(vars_list)

        # Constraint 3: Faculty Non-Overlap
        for (fid, d, t), vars_list in fac_period_vars.items():
            if len(vars_list) > 1:
                model.AddAtMostOne(vars_list)

        # Constraint 4: Faculty Daily Maximum Hours
        for (fid, d), terms in fac_day_terms.items():
            max_h = self.faculty[fid].get("max_hours_per_day", 4)
            model.Add(sum(terms) <= max_h)

        # Constraint 5: Elective Basket Synchronization
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

        # Constraint 6: Student Group Non-Overlap with Basket Key Sharing
        basket_active: Dict[Tuple[str, str, int], cp_model.IntVar] = {}
        for b_slot, b_sessions in baskets.items():
            rep_sid = b_sessions[0]
            dur = self.sessions[rep_sid].get("duration", 1)
            for d in DAYS:
                for t in TEACHING_PERIODS:
                    covering_vars = []
                    for p in range(max(1, t - dur + 1), t + 1):
                        covering_vars.extend(basket_day_start_vars[(b_slot, d, p)][rep_sid])
                    if covering_vars:
                        b_var = model.NewBoolVar(f"bact_{b_slot}_{d}_{t}")
                        model.Add(b_var == sum(covering_vars))
                        basket_active[(b_slot, d, t)] = b_var

        for gid in self.groups:
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
        # Rescheduling Objective: 10000 * moved + soft_penalty
        # =====================================================================
        objective_terms = []

        # Moved sessions penalty:
        # For session in baseline: if placed at baseline (d0, p0, r0), moved = 0; else moved = 1
        for sid, (d0, p0, r0) in self.baseline_assign.items():
            if sid in self.sessions:
                base_key = (sid, d0, p0, r0)
                if base_key in x:
                    # x[base_key] == 1 -> stay -> moved = 0
                    # x[base_key] == 0 -> move -> moved = 1
                    # So penalty term is 10000 * (1 - x[base_key])
                    objective_terms.append((1 - x[base_key]) * 10000)
                    # Warm start hint
                    model.AddHint(x[base_key], 1)
                else:
                    # Cannot stay at baseline (e.g. baseline slot invalidated by disruption)
                    objective_terms.append(10000)

        # Soft penalties (S1, S5, S6)
        for (sid, d, p, rid), var in x.items():
            fid = self.sessions[sid]["faculty_id"]
            dur = self.sessions[sid].get("duration", 1)
            avoided_hours = sum(1 for t in range(p, p + dur) if (fid, d, t) in self.fac_avoid)
            if avoided_hours > 0:
                objective_terms.append(var * (2 * avoided_hours))

            cap = self.rooms[rid]["capacity"]
            size = self.sessions[sid]["size"]
            if cap > 0 and (size / cap) < 0.4:
                objective_terms.append(var * 1)

            if p <= 9 <= (p + dur - 1):
                objective_terms.append(var * 1)

        model.Minimize(sum(objective_terms))

        # Solve
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = float(self.time_limit)
        solver.parameters.num_workers = 8
        solver.parameters.random_seed = 42

        start_time = time.time()
        status = solver.Solve(model)
        elapsed = time.time() - start_time

        logger.info(f"Rescheduler status: {solver.StatusName(status)} in {elapsed:.2f}s")

        if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
            new_sessions: List[Dict[str, Any]] = []
            moved_details: List[Dict[str, Any]] = []
            time_changed = 0
            room_only_changed = 0

            for (sid, d, p, rid), var in x.items():
                if solver.Value(var) == 1:
                    new_sessions.append({
                        "session_id": sid,
                        "day": d,
                        "start_period": p,
                        "room_id": rid,
                    })
                    # Check if moved from baseline
                    if sid in self.baseline_assign:
                        b_day, b_start, b_room = self.baseline_assign[sid]
                        if (d, p, rid) != (b_day, b_start, b_room):
                            is_time = (d, p) != (b_day, b_start)
                            if is_time:
                                time_changed += 1
                            else:
                                room_only_changed += 1

                            moved_details.append({
                                "session_id": sid,
                                "old": {"day": b_day, "start_period": b_start, "room_id": b_room},
                                "new": {"day": d, "start_period": p, "room_id": rid},
                                "change_type": "time_and_room" if is_time and rid != b_room else ("time" if is_time else "room_only"),
                            })

            schedule_after: Dict[str, Any] = {
                "dataset_id": self.data.get("dataset_id", "cit-public-v1"),
                "team": self.base_schedule.get("team", "CIT Automated Solver"),
                "sessions": new_sessions,
                "fest_week": self.base_schedule.get("fest_week", {}),
                "exams": self.base_schedule.get("exams", []),
            }

            # Validate schedule_after using official validator
            rep = run_official_validator(self.data, schedule_after, baseline=self.base_schedule)

            summary = {
                "sessions_moved": len(moved_details),
                "time_changed": time_changed,
                "room_only_changed": room_only_changed,
                "moved_details": moved_details,
                "validator_report": rep,
                "hard_violations": rep.get("hard_count", 0),
                "soft_total": rep.get("soft_total", 0),
            }

            return schedule_after, summary
        else:
            return None, {"error": "Infeasible disruption: constraints cannot be satisfied."}


def reschedule(
    base_data: Dict[str, Any],
    base_schedule: Dict[str, Any],
    disruption: Dict[str, Any],
    time_limit_seconds: int = 30,
) -> Tuple[Optional[Dict[str, Any]], Dict[str, Any]]:
    """Helper entry point for rescheduling."""
    rescheduler = Rescheduler(base_data, base_schedule, disruption, time_limit_seconds=time_limit_seconds)
    return rescheduler.re_solve()
