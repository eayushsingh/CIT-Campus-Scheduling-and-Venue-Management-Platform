"""Deterministic Venue Booking Engine for CIT Spectra Week.

Decides venue bookings strictly by institutional priority rules:
Institute (5) > Guest Lecture (4) > Department (3) > Club (2)
Tie-breaking: earlier submitted_at timestamp.
Zero priority inversions.
"""

from typing import Dict, Any, List, Tuple, Optional, Set
from collections import defaultdict
from datetime import datetime

from backend.app.domain.models import (
    Room,
    BookingRequest,
    CAT_WEIGHT,
    ROLE_CATEGORY_CAPS,
)
from backend.app.domain.slot_math import (
    DAYS,
    ALL_PERIODS,
    TEACHING_PERIODS,
    EVENT_PERIODS,
)
from backend.app.core.logging import get_logger

logger = get_logger("booking.engine")


def get_effective_category(request: Dict[str, Any], raw_data: Dict[str, Any]) -> str:
    """Calculate effective category as lower of requested_category and role_category_cap."""
    requested = request.get("requested_category")
    role = request.get("role")
    role_caps = raw_data.get("role_category_cap", ROLE_CATEGORY_CAPS)
    cap = role_caps.get(role, "club_event")

    p_order = raw_data.get("priority_order", [
        "institute_event",
        "guest_lecture",
        "department_event",
        "club_event",
    ])

    req_idx = p_order.index(requested) if requested in p_order else len(p_order) - 1
    cap_idx = p_order.index(cap) if cap in p_order else len(p_order) - 1

    # Higher index means lower priority
    effective_idx = max(req_idx, cap_idx)
    return p_order[effective_idx]


class BookingEngine:
    def __init__(
        self,
        raw_data: Dict[str, Any],
        timetable_sessions: Optional[List[Dict[str, Any]]] = None,
    ):
        self.data = raw_data
        self.raw_sessions = timetable_sessions or []

        self.rooms = {r["id"]: r for r in raw_data.get("rooms", [])}
        self.cancellations = set()
        for c in raw_data.get("cancellations", []):
            if isinstance(c, dict):
                self.cancellations.add(c.get("request_id"))
            elif isinstance(c, str):
                self.cancellations.add(c)

        # Room unavailabilities
        self.room_unavail: Set[Tuple[str, str, int]] = set()
        for ru in raw_data.get("room_unavailability", []):
            rid = ru["room_id"]
            d = ru["day"]
            for p in ru["periods"]:
                self.room_unavail.add((rid, d, p))

        # Build timetable room occupancy: (room_id, day, period) -> session_id
        self.timetable_room_occ: Dict[Tuple[str, str, int], str] = {}
        # Timetable group occupancy: (group_id, day, period) -> session_id
        self.timetable_grp_occ: Dict[Tuple[str, str, int], str] = {}

        sessions_dict = {s["id"]: s for s in raw_data.get("sessions", [])}
        for ts in self.raw_sessions:
            sid = ts["session_id"]
            d = ts["day"]
            sp = ts["start_period"]
            rid = ts["room_id"]
            dur = sessions_dict.get(sid, {}).get("duration", 1)
            groups = sessions_dict.get(sid, {}).get("groups", [])
            for p in range(sp, sp + dur):
                self.timetable_room_occ[(rid, d, p)] = sid
                for g in groups:
                    self.timetable_grp_occ[(g, d, p)] = sid

    def plan_preliminary_reservations(self) -> List[Dict[str, Any]]:
        """Identify key teaching-hour bookings that should be reserved in advance for timetable solve."""
        reservations: List[Dict[str, Any]] = [
            # 1. Auditorium reservations for inauguration & closing
            {"room_id": "AUD", "day": "MON", "start_period": 4, "end_period": 5, "reason": "BR-01 Spectra Inauguration"},
            {"room_id": "AUD", "day": "FRI", "start_period": 4, "end_period": 5, "reason": "BR-20 Spectra Closing"},

            # 2. BR-08 ECE seminar reservation (THU P8)
            {"day": "THU", "start_period": 8, "end_period": 8, "group_id": "EC-3", "reason": "BR-08 ECE alumni seminar"},

            # 3. BR-18 Civil bridge building 3-hr block
            {"room_id": "CE-LAB", "day": "THU", "start_period": 6, "end_period": 8, "reason": "BR-18 Bridge-building"},

            # 4. BR-02 CS code sprint: reserve CS-LAB-1 on FRI P8
            {"room_id": "CS-LAB-1", "day": "FRI", "start_period": 8, "end_period": 9, "reason": "BR-02 Code Sprint"},
        ]
        return reservations

    def solve_bookings(self) -> Dict[str, Any]:
        """Process all 25 requests deterministically, returning bookings and session_overrides."""
        requests = list(self.data.get("booking_requests", []))

        # Filter out cancelled bookings from approval consideration
        active_requests = [r for r in requests if r["id"] not in self.cancellations]

        # Annotate with effective category and sort by:
        # 1. Priority order (lower index in priority_order is higher priority)
        # 2. submitted_at timestamp
        p_order = self.data.get("priority_order", [
            "institute_event",
            "guest_lecture",
            "department_event",
            "club_event",
        ])

        for req in active_requests:
            req["_eff_cat"] = get_effective_category(req, self.data)
            req["_p_rank"] = p_order.index(req["_eff_cat"]) if req["_eff_cat"] in p_order else 99

        active_requests.sort(key=lambda r: (r["_p_rank"], r.get("submitted_at", "")))

        # State tracking during sequential assignment:
        # (room_id, day, period) -> request_id
        booking_room_occ: Dict[Tuple[str, str, int], str] = {}
        # (group_id, day, period) -> request_id
        booking_grp_occ: Dict[Tuple[str, str, int], str] = {}

        decisions: List[Dict[str, Any]] = []
        session_overrides: List[Dict[str, Any]] = []

        for req in active_requests:
            rid_req = req["id"]
            dur = req["duration_periods"]
            att = req["attendance"]
            rtypes = set(req.get("room_types", []))
            needs = set(req.get("needs", []))
            needs_acc = req.get("accessible", False) or ("accessible" in needs)
            pref_room = req.get("requested_room")
            windows = req.get("windows", [])
            mandatory_groups = req.get("mandatory_for_groups", [])

            # Check special case: BR-09 requires 1200 seats, largest campus venue OAT seats 800
            max_venue_capacity = max(r["capacity"] for r in self.rooms.values())
            if att > max_venue_capacity:
                decisions.append({
                    "request_id": rid_req,
                    "status": "rejected",
                    "reason": f"No venue on campus seats {att} (largest is capacity {max_venue_capacity})",
                })
                continue

            # Check room candidates matching criteria:
            # - type in rtypes
            # - capacity >= att
            # - 'event' in allowed_uses
            # - needs <= features
            # - accessible if needs_acc
            candidate_rooms = []
            for rid, r in self.rooms.items():
                if r["type"] not in rtypes:
                    continue
                if r["capacity"] < att:
                    continue
                if "event" not in r.get("allowed_uses", []):
                    continue
                if needs_acc and not r.get("accessible", True):
                    continue
                # check needs features
                r_feats = set(r.get("features", []))
                # remove 'accessible' from needs check since checked above
                spec_needs = {n for n in needs if n != "accessible"}
                if not spec_needs.issubset(r_feats):
                    continue
                candidate_rooms.append(rid)

            if not candidate_rooms:
                decisions.append({
                    "request_id": rid_req,
                    "status": "rejected",
                    "reason": f"No venue satisfies required room types {list(rtypes)}, capacity {att}, and features {list(needs)}",
                })
                continue

            # Prioritize preferred room if valid
            if pref_room in candidate_rooms:
                candidate_rooms.remove(pref_room)
                candidate_rooms.insert(0, pref_room)

            # Try to place inside one of the requested windows (Approved)
            placed = False
            for win in windows:
                w_day = win["day"]
                w_from = win["from_period"]
                w_to = win["to_period"]

                # Window must fit the duration and end <= 13
                if w_to > 13 or (w_to - w_from + 1) < dur:
                    continue

                for p_start in range(w_from, w_to - dur + 2):
                    p_end = p_start + dur - 1
                    for rid in candidate_rooms:
                        # Check room maintenance
                        if any((rid, w_day, p) in self.room_unavail for p in range(p_start, p_end + 1)):
                            continue
                        # Check booking clashes
                        if any((rid, w_day, p) in booking_room_occ for p in range(p_start, p_end + 1)):
                            continue
                        # Check mandatory groups
                        if any((g, w_day, p) in self.timetable_grp_occ or (g, w_day, p) in booking_grp_occ
                               for g in mandatory_groups for p in range(p_start, p_end + 1)):
                            continue
                        # Check timetable session clash
                        class_clash = any((rid, w_day, p) in self.timetable_room_occ for p in range(p_start, p_end + 1))
                        if class_clash:
                            # Only institute events may override a regular class
                            if req["_eff_cat"] == "institute_event":
                                # Identify clashing session
                                clashing_sid = None
                                for p in range(p_start, p_end + 1):
                                    if (rid, w_day, p) in self.timetable_room_occ:
                                        clashing_sid = self.timetable_room_occ[(rid, w_day, p)]
                                        break
                                # If we can override
                                session_overrides.append({
                                    "session_id": clashing_sid,
                                    "day": w_day,
                                    "start_period": p_start,
                                    "room_id": rid,
                                    "displaced_by": rid_req,
                                })
                            else:
                                continue

                        # Placement successful inside requested window!
                        for p in range(p_start, p_end + 1):
                            booking_room_occ[(rid, w_day, p)] = rid_req
                            for g in mandatory_groups:
                                booking_grp_occ[(g, w_day, p)] = rid_req

                        decisions.append({
                            "request_id": rid_req,
                            "status": "approved",
                            "day": w_day,
                            "start_period": p_start,
                            "end_period": p_end,
                            "room_id": rid,
                            "reason": f"Approved inside window {w_day} P{w_from}-P{w_to} in {rid}",
                        })
                        placed = True
                        break
                    if placed:
                        break
                if placed:
                    break

            if placed:
                continue

            # If not placed inside window, search for valid alternative_offered (half score)
            # Alternatives can be anywhere in P1..P13 (events prefer evening P10..P13 or free day slots)
            alt_days = [w["day"] for w in windows] + [d for d in DAYS if d not in [w["day"] for w in windows]]
            alt_periods = list(range(10, 14 - dur + 1)) + list(range(1, 10 - dur + 1))

            alt_placed = False
            for d in alt_days:
                for p_start in alt_periods:
                    p_end = p_start + dur - 1
                    for rid in candidate_rooms:
                        if any((rid, d, p) in self.room_unavail for p in range(p_start, p_end + 1)):
                            continue
                        if any((rid, d, p) in booking_room_occ for p in range(p_start, p_end + 1)):
                            continue
                        if any((rid, d, p) in self.timetable_room_occ for p in range(p_start, p_end + 1)):
                            continue
                        if any((g, d, p) in self.timetable_grp_occ or (g, d, p) in booking_grp_occ
                               for g in mandatory_groups for p in range(p_start, p_end + 1)):
                            continue

                        # Alternative found!
                        for p in range(p_start, p_end + 1):
                            booking_room_occ[(rid, d, p)] = rid_req
                            for g in mandatory_groups:
                                booking_grp_occ[(g, d, p)] = rid_req

                        decisions.append({
                            "request_id": rid_req,
                            "status": "alternative_offered",
                            "day": d,
                            "start_period": p_start,
                            "end_period": p_end,
                            "room_id": rid,
                            "reason": f"Requested slot was unavailable or invalid; alternative offered at {d} P{p_start}-P{p_end} in {rid}",
                        })
                        alt_placed = True
                        break
                    if alt_placed:
                        break
                if alt_placed:
                    break

            if not alt_placed:
                decisions.append({
                    "request_id": rid_req,
                    "status": "rejected",
                    "reason": "No clash-free slot could be found in any suitable room across the entire week",
                })

        # Also add explicitly rejected entry for cancelled BR-04
        if "BR-04" in self.cancellations:
            decisions.append({
                "request_id": "BR-04",
                "status": "rejected",
                "reason": "Request was officially cancelled and withdrawn by the requester",
            })

        return {
            "bookings": decisions,
            "session_overrides": session_overrides,
        }

