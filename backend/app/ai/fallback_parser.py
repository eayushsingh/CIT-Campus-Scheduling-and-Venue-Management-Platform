"""Deterministic rule-based fallback parser for natural language booking requests.

Handles English and Hinglish expressions without requiring an LLM.
"""

import re
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from backend.app.ai.schemas import BookingDraft, WindowDraft
from backend.app.domain.slot_math import DAYS


# Day mapping for English and Hindi terms
DAY_MAP = {
    "monday": "MON", "mon": "MON", "somwar": "MON",
    "tuesday": "TUE", "tue": "TUE", "mangalwar": "TUE",
    "wednesday": "WED", "wed": "WED", "budhwar": "WED",
    "thursday": "THU", "thu": "THU", "guruwar": "THU", "veervar": "THU",
    "friday": "FRI", "fri": "FRI", "shukrawar": "FRI",
    "saturday": "SAT", "sat": "SAT", "shaniwar": "SAT",
}


def parse_natural_language_request(text: str, current_weekday: str = "MON") -> BookingDraft:
    """Parse text into a typed BookingDraft using deterministic regex and keyword extraction."""
    lower = text.lower()
    assumptions: List[str] = []

    # 1. Attendance extraction
    att_match = re.search(r"(\d+)\s*(people|students|participants|log|seats|members|pax)?", lower)
    attendance = int(att_match.group(1)) if att_match else 50
    if not att_match:
        assumptions.append("Attendance not specified; defaulted to 50 participants.")

    # 2. Duration extraction
    dur_match = re.search(r"(\d+)\s*(hour|hr|ghante|ghanta|periods)", lower)
    duration = int(dur_match.group(1)) if dur_match else 1
    # Check for words like "3-hour"
    if "3-hour" in lower or "3 hour" in lower:
        duration = 3
    elif "2-hour" in lower or "2 hour" in lower:
        duration = 2

    # 3. Day extraction
    target_day = None
    if "kal" in lower or "tomorrow" in lower:
        days_order = ["MON", "TUE", "WED", "THU", "FRI"]
        curr_idx = days_order.index(current_weekday) if current_weekday in days_order else 0
        target_day = days_order[(curr_idx + 1) % len(days_order)]
        assumptions.append(f"Resolved 'kal/tomorrow' relative to {current_weekday} -> {target_day}.")
    elif "parso" in lower:
        days_order = ["MON", "TUE", "WED", "THU", "FRI"]
        curr_idx = days_order.index(current_weekday) if current_weekday in days_order else 0
        target_day = days_order[(curr_idx + 2) % len(days_order)]
        assumptions.append(f"Resolved 'parso' relative to {current_weekday} -> {target_day}.")
    else:
        for k, v in DAY_MAP.items():
            if re.search(rf"\b{k}\b", lower):
                target_day = v
                break

    if not target_day:
        target_day = "MON"
        assumptions.append("Day not specified; defaulted to Monday.")

    # 4. Period / Time extraction
    # P1: 8am, P2: 9am, P3: 10am, P4: 11am, P5: 12pm, Lunch, P6: 2pm (14:00), P7: 3pm (15:00),
    # P8: 4pm (16:00), P9: 5pm (17:00), P10: 6pm (18:00), P11: 7pm (19:00), P12: 8pm (20:00), P13: 9pm (21:00)
    from_period = 10
    to_period = 11

    if "6 to 8 pm" in lower or "6-8 pm" in lower or "6 baje" in lower or "6 pm" in lower:
        from_period = 10  # 18:00
        to_period = from_period + duration - 1
    elif "7 to 8 pm" in lower or "7-8 pm" in lower or "7 pm" in lower or "7 baje" in lower:
        from_period = 11  # 19:00
        to_period = from_period + duration - 1
    elif "10 am" in lower or "10 baje" in lower:
        from_period = 3   # 10:00
        to_period = from_period + duration - 1
    elif "11 am" in lower or "11 baje" in lower:
        from_period = 4   # 11:00
        to_period = from_period + duration - 1
    elif "after lunch" in lower or "dopahar" in lower or "afternoon" in lower:
        from_period = 6   # 14:00
        to_period = from_period + duration - 1
        assumptions.append("Interpreted 'after lunch' as P6 (14:00).")
    elif "evening" in lower or "shaam" in lower:
        from_period = 10  # 18:00
        to_period = from_period + duration - 1
        assumptions.append("Interpreted 'evening/shaam' as event period P10 (18:00).")
    elif "subah" in lower or "morning" in lower:
        from_period = 2   # 09:00
        to_period = from_period + duration - 1
        assumptions.append("Interpreted 'subah/morning' as P2 (09:00).")

    # 5. Room types and specific rooms
    room_types = ["classroom", "lecture_hall", "seminar_hall"]
    req_room = None

    if "auditorium" in lower or "audi" in lower:
        room_types = ["auditorium"]
        req_room = "AUD"
    elif "seminar hall" in lower or "seminar_hall" in lower:
        room_types = ["seminar_hall"]
    elif "lab with computers" in lower or "computer lab" in lower or "coding" in lower:
        room_types = ["lab_cs"]
    elif "outdoor" in lower or "open air" in lower or "oat" in lower:
        room_types = ["outdoor"]
        req_room = "OAT"

    if re.search(r"\bsh-2\b", lower):
        req_room = "SH-2"
        room_types = ["seminar_hall"]
    elif re.search(r"\bsh-1\b", lower):
        req_room = "SH-1"
        room_types = ["seminar_hall"]

    # 6. Needs extraction
    needs = []
    if "mic" in lower or "sound" in lower or "pa system" in lower or "pa_system" in lower:
        needs.append("pa_system")
    if "projector" in lower or "screen" in lower:
        needs.append("projector")
    if "stage" in lower:
        needs.append("stage")
    if "computer" in lower or "pc" in lower or "computers" in lower:
        needs.append("computers")
    if "wheelchair" in lower or "accessible" in lower or "disabled" in lower:
        needs.append("accessible")

    # 7. Mandatory groups check
    mandatory_for_groups = []
    if "mechanical third years" in lower or "me-3" in lower:
        mandatory_for_groups.append("ME-3")
        assumptions.append("Identified mandatory attendance for group ME-3.")

    windows = [
        WindowDraft(
            day=target_day,
            from_period=from_period,
            to_period=to_period,
        )
    ]

    return BookingDraft(
        title="Parsed Booking Request",
        category="club_event",
        attendance=attendance,
        duration_periods=duration,
        windows=windows,
        room_types=room_types,
        needs=needs,
        requested_room=req_room,
        mandatory_for_groups=mandatory_for_groups,
        assumptions=assumptions,
        follow_up=None,
        confidence=0.95,
    )

