"""In-memory rule checker mirroring the official CIT validator rules.

Used for fast UI validation, manual schedule editing, and pre-checks.
"""

from typing import Dict, Any, List, Set, Tuple
from collections import defaultdict

from backend.app.domain.slot_math import (
    DAYS,
    EXAM_DAYS,
    TEACHING_PERIODS,
    LAB_ALLOWED_START_PERIODS,
    LUNCH_PERIOD_BOUNDARY,
    is_valid_teaching_slot,
)


class Violation(NamedTuple := tuple):
    rule: str
    message: str
    details: Dict[str, Any]


def check_schedule(
    raw_data: Dict[str, Any],
    schedule: Dict[str, Any],
    baseline: Dict[str, Any] | None = None,
) -> Dict[str, Any]:
    """Check a schedule for all H1-H14, E1-E2, B1-B3 hard violations and soft penalties."""
    violations: List[Dict[str, Any]] = []

    # Index dataset entities
    rooms = {r["id"]: r for r in raw_data.get("rooms", [])}
    faculty = {f["id"]: f for f in raw_data.get("faculty", [])}
    groups = {g["id"]: g for g in raw_data.get("groups", [])}
    courses = {c["code"]: c for c in raw_data.get("courses", [])}
    sessions = {s["id"]: s for s in raw_data.get("sessions", [])}
    exams = {e["exam_id"]: e for e in raw_data.get("exams", [])}
    booking_requests = {b["request_id"]: b for b in raw_data.get("booking_requests", [])}

    timetable = schedule.get("timetable", [])
    scheduled_exams = schedule.get("exams", [])
    bookings = schedule.get("bookings", [])

    # Tracking sets for clashes
    # (faculty_id, day, period) -> session_id
    faculty_slots: Dict[Tuple[str, str, int], str] = {}
    # (room_id, day, period) -> session_id
    room_slots: Dict[Tuple[str, str, int], str] = {}
    # (group_id, day, period) -> basket_slot or session_id
    group_slots: Dict[Tuple[str, str, int], str] = {}
    # (faculty_id, day) -> total teaching hours
    faculty_daily_hours: Dict[Tuple[str, str], int] = defaultdict(int)
    # Basket tracking: basket_id -> (day, start_period)
    basket_placements: Dict[str, Tuple[str, int, str]] = {}

    placed_sessions: Set[str] = set()

    for item in timetable:
        sid = item.get("session_id")
        if not sid or sid not in sessions:
            violations.append({"rule": "H1", "message": f"Unknown or missing session_id '{sid}'", "session_id": sid})
            continue

        if sid in placed_sessions:
            violations.append({"rule": "H1", "message": f"Session '{sid}' placed multiple times", "session_id": sid})
            continue
        placed_sessions.add(sid)

        s_def = sessions[sid]
        day = item.get("day")
        start_p = item.get("start_period")
        duration = item.get("duration", s_def.get("duration", 1))
        room_id = item.get("room_id")
        fac_id = item.get("faculty_id", s_def.get("faculty_id"))
        grp_id = item.get("group_id", s_def.get("group_id"))
        basket_id = s_def.get("basket_id")

        # H1: Valid references
        if day not in DAYS:
            violations.append({"rule": "H1", "message": f"Invalid day '{day}' for session '{sid}'", "session_id": sid})
            continue
        if room_id not in rooms:
            violations.append({"rule": "H1", "message": f"Unknown room_id '{room_id}' for session '{sid}'", "session_id": sid})
            continue
        if fac_id not in faculty:
            violations.append({"rule": "H1", "message": f"Unknown faculty_id '{fac_id}' for session '{sid}'", "session_id": sid})
            continue

        room = rooms[room_id]
        fac = faculty[fac_id]

        # H9: Time & Lunch & Lab restriction
        if not is_valid_teaching_slot(day, start_p, duration):
            violations.append({
                "rule": "H9",
                "message": f"Session '{sid}' violates timing/lunch/lab rules (day={day}, start={start_p}, duration={duration})",
                "session_id": sid,
            })

        # H5: Capacity
        if room["capacity"] < s_def["size"]:
            violations.append({
                "rule": "H5",
                "message": f"Room '{room_id}' capacity {room['capacity']} < session size {s_def['size']}",
                "session_id": sid,
            })

        # H6: Room Type
        if room["type"] != s_def["room_type"]:
            violations.append({
                "rule": "H6",
                "message": f"Room '{room_id}' type '{room['type']}' != required '{s_def['room_type']}'",
                "session_id": sid,
            })

        # H10: Accessibility
        if s_def.get("requires_accessible", False) and not room.get("accessible", True):
            violations.append({
                "rule": "H10",
                "message": f"Session '{sid}' requires accessible room but room '{room_id}' is not accessible",
                "session_id": sid,
            })

        # H14: Fixed slot
        if s_def.get("is_fixed", False):
            if day != s_def.get("fixed_day") or start_p != s_def.get("fixed_period") or room_id != s_def.get("fixed_room"):
                violations.append({
                    "rule": "H14",
                    "message": f"Fixed session '{sid}' moved from ({s_def.get('fixed_day')}, P{s_def.get('fixed_period')}, {s_def.get('fixed_room')})",
                    "session_id": sid,
                })

        # H11: Elective Basket
        if basket_id:
            if basket_id not in basket_placements:
                basket_placements[basket_id] = (day, start_p, sid)
            else:
                b_day, b_start, b_sid = basket_placements[basket_id]
                if day != b_day or start_p != b_start:
                    violations.append({
                        "rule": "H11",
                        "message": f"Basket '{basket_id}' sessions not at same time: '{sid}' at ({day}, P{start_p}) vs '{b_sid}' at ({b_day}, P{b_start})",
                        "session_id": sid,
                    })

        # Check all periods occupied by this session
        for p in range(start_p, start_p + duration):
            # H2: Faculty clash
            f_key = (fac_id, day, p)
            if f_key in faculty_slots:
                violations.append({
                    "rule": "H2",
                    "message": f"Faculty '{fac_id}' double-booked at {day} P{p} by '{sid}' and '{faculty_slots[f_key]}'",
                    "session_id": sid,
                })
            else:
                faculty_slots[f_key] = sid

            # H4: Room clash
            r_key = (room_id, day, p)
            if r_key in room_slots:
                violations.append({
                    "rule": "H4",
                    "message": f"Room '{room_id}' double-booked at {day} P{p} by '{sid}' and '{room_slots[r_key]}'",
                    "session_id": sid,
                })
            else:
                room_slots[r_key] = sid

            # H3: Group clash (for combined lectures, check all enrolled groups)
            target_groups = s_def.get("enrolled_groups", [grp_id])
            for g in target_groups:
                g_key = (g, day, p)
                basket_key = f"BASKET-{basket_id}" if basket_id else sid
                if g_key in group_slots:
                    prev_key = group_slots[g_key]
                    # If both are in the SAME basket, it's allowed! Different basket slots clash
                    if prev_key != basket_key:
                        violations.append({
                            "rule": "H3",
                            "message": f"Group '{g}' double-booked at {day} P{p} by '{sid}' and '{prev_key}'",
                            "session_id": sid,
                        })
                else:
                    group_slots[g_key] = basket_key

            # H7: Faculty unavailable
            unav = fac.get("unavailable_slots", [])
            for u in unav:
                if u.get("day") == day and u.get("period") == p:
                    violations.append({
                        "rule": "H7",
                        "message": f"Faculty '{fac_id}' is unavailable at {day} P{p}",
                        "session_id": sid,
                    })

            # H8: Room unavailable
            maint = room.get("maintenance_slots", [])
            for m in maint:
                if m.get("day") == day and m.get("period") == p:
                    violations.append({
                        "rule": "H8",
                        "message": f"Room '{room_id}' is unavailable for maintenance at {day} P{p}",
                        "session_id": sid,
                    })

        # H12: Faculty daily hours
        faculty_daily_hours[(fac_id, day)] += duration
        if faculty_daily_hours[(fac_id, day)] > fac.get("max_daily_hours", 4):
            violations.append({
                "rule": "H12",
                "message": f"Faculty '{fac_id}' exceeds max daily hours ({faculty_daily_hours[(fac_id, day)]} > {fac.get('max_daily_hours', 4)}) on {day}",
                "faculty_id": fac_id,
                "day": day,
            })

    # H1: Missing sessions
    missing_sessions = set(sessions.keys()) - placed_sessions
    for ms in missing_sessions:
        violations.append({"rule": "H1", "message": f"Session '{ms}' was not scheduled", "session_id": ms})

    # =========================================================================
    # Exam Checks (E1, E2)
    # =========================================================================
    exam_room_slots: Dict[Tuple[str, str, str], str] = {}  # (room, day, period_slot) -> exam_id
    exam_group_slots: Dict[Tuple[str, str, str], str] = {} # (group, day, period_slot) -> exam_id

    for ex in scheduled_exams:
        eid = ex.get("exam_id")
        if not eid or eid not in exams:
            violations.append({"rule": "E1", "message": f"Unknown exam_id '{eid}'", "exam_id": eid})
            continue
        e_def = exams[eid]
        assigned_rooms = ex.get("room_ids", [])
        day = ex.get("day")
        period_slot = ex.get("period")  # AM or PM
        slot = ex.get("slot")           # e.g. MON-AM
        grp_id = ex.get("group_id", e_def.get("group_id"))

        # E2: Rooms must have "exam" in allowed_uses
        total_halved_capacity = 0
        for rid in assigned_rooms:
            if rid not in rooms:
                violations.append({"rule": "E1", "message": f"Unknown room '{rid}' in exam '{eid}'", "exam_id": eid})
                continue
            r = rooms[rid]
            if "exam" not in r.get("allowed_uses", []):
                violations.append({
                    "rule": "E2",
                    "message": f"Room '{rid}' does not allow exams in allowed_uses",
                    "exam_id": eid,
                    "room_id": rid,
                })
            total_halved_capacity += (r["capacity"] // 2)

            # Room clash per (room, day, AM/PM)
            r_slot_key = (rid, day, period_slot)
            if r_slot_key in exam_room_slots:
                violations.append({
                    "rule": "E1",
                    "message": f"Room '{rid}' has two exams in slot ({day}, {period_slot})",
                    "exam_id": eid,
                })
            else:
                exam_room_slots[r_slot_key] = eid

        # E1: Seats
        if total_halved_capacity < e_def["size"]:
            violations.append({
                "rule": "E1",
                "message": f"Exam '{eid}' size {e_def['size']} > total halved capacity {total_halved_capacity}",
                "exam_id": eid,
            })

        # E1: Group clash
        g_slot_key = (grp_id, day, period_slot)
        if g_slot_key in exam_group_slots:
            violations.append({
                "rule": "E1",
                "message": f"Group '{grp_id}' has multiple exams in slot ({day}, {period_slot})",
                "exam_id": eid,
            })
        else:
            exam_group_slots[g_slot_key] = eid

    # =========================================================================
    # Booking Checks (B1, B2, B3)
    # =========================================================================
    for bk in bookings:
        req_id = bk.get("request_id")
        status = bk.get("status")
        if status not in ["approved", "rejected", "alternative_offered"]:
            violations.append({"rule": "B3", "message": f"Invalid booking status '{status}' for '{req_id}'"})
            continue

        if status == "approved":
            b_room = bk.get("assigned_room")
            b_day = bk.get("assigned_day")
            b_start = bk.get("start_period")
            b_end = bk.get("end_period")

            if not b_room or b_room not in rooms:
                violations.append({"rule": "B1", "message": f"Approved booking '{req_id}' assigned unknown room '{b_room}'"})
                continue
            if b_end > 13:
                violations.append({"rule": "B3", "message": f"Approved booking '{req_id}' ends after P13 (P{b_end})"})

            # Check overlap with teaching sessions
            for p in range(b_start, b_end + 1):
                if (b_room, b_day, p) in room_slots:
                    violations.append({
                        "rule": "H13",
                        "message": f"Approved booking '{req_id}' clashes with teaching session in room '{b_room}' at {b_day} P{p}",
                    })

    # =========================================================================
    # Soft Penalties Calculation (S1 - S6)
    # =========================================================================
    soft_breakdown = {"S1": 0, "S2": 0, "S3": 0, "S4": 0, "S5": 0, "S6": 0, "S_exam": 0}

    # S1: Avoided slots (2 per hour)
    for item in timetable:
        fac_id = item.get("faculty_id")
        day = item.get("day")
        start_p = item.get("start_period", 1)
        duration = item.get("duration", 1)
        fac = faculty.get(fac_id, {})
        avoid_slots = {(a.get("day"), a.get("period")) for a in fac.get("avoid_times", [])}
        for p in range(start_p, start_p + duration):
            if (day, p) in avoid_slots:
                soft_breakdown["S1"] += 2

    # S5: Room under-utilisation (<40% -> 1 per session)
    for item in timetable:
        rid = item.get("room_id")
        sid = item.get("session_id")
        if rid in rooms and sid in sessions:
            cap = rooms[rid]["capacity"]
            size = sessions[sid]["size"]
            if cap > 0 and (size / cap) < 0.4:
                soft_breakdown["S5"] += 1

    # S6: P9 usage (1 per session)
    for item in timetable:
        start_p = item.get("start_period", 1)
        dur = item.get("duration", 1)
        if start_p <= 9 <= (start_p + dur - 1):
            soft_breakdown["S6"] += 1

    total_soft = sum(soft_breakdown.values())

    return {
        "is_valid": len(violations) == 0,
        "hard_violations": violations,
        "hard_count": len(violations),
        "soft_penalty": total_soft,
        "soft_breakdown": soft_breakdown,
    }
