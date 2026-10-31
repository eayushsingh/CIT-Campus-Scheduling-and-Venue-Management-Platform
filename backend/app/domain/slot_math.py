"""Slot definitions and time conversion math for CIT Scheduler."""

from enum import Enum
from typing import NamedTuple

DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
EXAM_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

TEACHING_PERIODS = list(range(1, 10))   # P1 .. P9
EVENT_PERIODS = list(range(10, 14))     # P10 .. P13
ALL_PERIODS = list(range(1, 14))        # P1 .. P13

LAB_ALLOWED_START_PERIODS = [2, 6]      # P2 ends at P4; P6 ends at P8
LUNCH_PERIOD_BOUNDARY = 5               # P5 ends 13:00, lunch is 13:00-14:00, P6 starts 14:00

EXAM_SLOTS = [
    f"{day[:3].upper()}-{half}"
    for day in EXAM_DAYS
    for half in ["AM", "PM"]
]  # 12 slots: MON-AM, MON-PM, ... SAT-PM


class TimeSlot(NamedTuple):
    day: str
    period: int


def is_valid_teaching_slot(day: str, start_period: int, duration: int) -> bool:
    """Validate that a teaching session sits cleanly within P1..P9 and does not straddle lunch."""
    if day not in DAYS:
        return False
    end_period = start_period + duration - 1
    if start_period < 1 or end_period > 9:
        return False
    # Crosses lunch check: cannot start <= 5 and end >= 6
    if start_period <= LUNCH_PERIOD_BOUNDARY and end_period > LUNCH_PERIOD_BOUNDARY:
        return False
    # Lab duration rule
    if duration == 3 and start_period not in LAB_ALLOWED_START_PERIODS:
        return False
    return True


def is_valid_event_slot(day: str, start_period: int, duration: int) -> bool:
    """Validate that an event sits within P1..P13."""
    if day not in DAYS:
        return False
    end_period = start_period + duration - 1
    return 1 <= start_period and end_period <= 13
