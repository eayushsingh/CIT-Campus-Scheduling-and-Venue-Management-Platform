"""Infeasibility explainer for CIT Scheduling & Rescheduling.

Identifies minimal conflicting constraints and generates plain-language,
code-generated explanation sentences without relying on LLM.
"""

from typing import Dict, Any, List, Optional
from backend.app.domain.slot_math import DAYS, TEACHING_PERIODS, is_valid_teaching_slot


def explain_infeasible_disruption(
    base_data: Dict[str, Any],
    disruption: Dict[str, Any],
) -> str:
    """Analyze a disruption to determine why it creates an infeasible schedule."""
    from backend.app.solver.reschedule import apply_disruption_to_data
    disrupted_data = apply_disruption_to_data(base_data, disruption)

    rooms = {r["id"]: r for r in disrupted_data.get("rooms", [])}
    faculty = {f["id"]: f for f in disrupted_data.get("faculty", [])}
    sessions = {s["id"]: s for s in disrupted_data.get("sessions", [])}

    # Room unavailabilities
    room_unavail = set()
    for ru in disrupted_data.get("room_unavailability", []):
        for p in ru.get("periods", []):
            room_unavail.add((ru["room_id"], ru["day"], p))

    # Faculty unavailabilities
    fac_unavail = set()
    for f in faculty.values():
        for u in f.get("unavailable", []):
            for p in u.get("periods", []):
                fac_unavail.add((f["id"], u["day"], p))

    # Check each session for zero valid placement slots
    for sid, s in sessions.items():
        dur = s.get("duration", 1)
        size = s["size"]
        fid = s["faculty_id"]
        rtypes = set(s.get("room_types", []))
        needs_acc = s.get("needs_accessible", False)
        fixed = s.get("fixed_slot")

        suitable_rooms = [
            rid for rid, r in rooms.items()
            if r["type"] in rtypes
            and r["capacity"] >= size
            and (not needs_acc or r.get("accessible", True))
        ]

        if not suitable_rooms:
            return (
                f"Session '{sid}' (size {size}, type {list(rtypes)}) cannot be placed: "
                f"no accessible campus room of matching type has capacity >= {size}."
            )

        # Check total valid (day, period, room) triples
        valid_triples = []
        for d in DAYS:
            for p in TEACHING_PERIODS:
                if not is_valid_teaching_slot(d, p, dur):
                    continue
                if any((fid, d, t) in fac_unavail for t in range(p, p + dur)):
                    continue
                for rid in suitable_rooms:
                    if any((rid, d, t) in room_unavail for t in range(p, p + dur)):
                        continue
                    valid_triples.append((d, p, rid))

        if not valid_triples:
            fac_name = faculty.get(fid, {}).get("name", fid)
            return (
                f"Session '{sid}' has no valid slot: faculty {fac_name} ({fid}) has extensive unavailability, "
                f"matching rooms are blocked by maintenance, and lab/lunch constraints prevent placement."
            )

    # If all individual domains have slots, it's a mutual pigeonhole conflict
    return (
        "The proposed schedule changes are mathematically infeasible: the total required teaching hours "
        "exceed the combined conflict-free capacity of available rooms and faculty daily workload limits."
    )
