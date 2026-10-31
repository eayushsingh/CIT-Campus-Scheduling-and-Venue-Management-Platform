"""Tests for domain models, slot math, and own_checker."""

import pytest
from backend.app.domain.slot_math import (
    is_valid_teaching_slot,
    is_valid_event_slot,
    LAB_ALLOWED_START_PERIODS,
    EXAM_SLOTS,
)
from backend.app.domain.models import (
    Room,
    Faculty,
    StudentGroup,
    Session,
    BookingCategory,
    CATEGORY_WEIGHTS,
    ROLE_CATEGORY_CAPS,
)
from backend.app.validation.own_checker import check_schedule


def test_slot_math_teaching_slots():
    """Verify teaching slot validity across lunch and period ranges."""
    # Normal 1-hour lectures
    assert is_valid_teaching_slot("Monday", 1, 1) is True
    assert is_valid_teaching_slot("Monday", 5, 1) is True
    assert is_valid_teaching_slot("Monday", 6, 1) is True
    assert is_valid_teaching_slot("Monday", 9, 1) is True

    # Out of teaching hours (P10)
    assert is_valid_teaching_slot("Monday", 10, 1) is False

    # Straddling lunch break (starts at P5, duration 2 -> ends at P6)
    assert is_valid_teaching_slot("Monday", 5, 2) is False

    # 3-hour labs (only allowed at P2 or P6)
    assert is_valid_teaching_slot("Monday", 2, 3) is True  # P2, P3, P4
    assert is_valid_teaching_slot("Monday", 6, 3) is True  # P6, P7, P8
    assert is_valid_teaching_slot("Monday", 1, 3) is False
    assert is_valid_teaching_slot("Monday", 3, 3) is False
    assert is_valid_teaching_slot("Monday", 4, 3) is False
    assert is_valid_teaching_slot("Monday", 7, 3) is False


def test_exam_slots_count():
    """Exam slots must be exactly 12 (Monday-Saturday x AM/PM)."""
    assert len(EXAM_SLOTS) == 12
    assert "MON-AM" in EXAM_SLOTS
    assert "SAT-PM" in EXAM_SLOTS


def test_booking_category_weights_and_caps():
    """Test official weights and role caps."""
    assert CATEGORY_WEIGHTS[BookingCategory.INSTITUTE] == 5
    assert CATEGORY_WEIGHTS[BookingCategory.GUEST_LECTURE] == 4
    assert CATEGORY_WEIGHTS[BookingCategory.DEPARTMENT] == 3
    assert CATEGORY_WEIGHTS[BookingCategory.CLUB] == 2

    # Role caps
    assert ROLE_CATEGORY_CAPS["club_rep"] == BookingCategory.CLUB
    assert ROLE_CATEGORY_CAPS["faculty"] == BookingCategory.GUEST_LECTURE
    assert ROLE_CATEGORY_CAPS["coordinator"] == BookingCategory.DEPARTMENT
    assert ROLE_CATEGORY_CAPS["admin"] == BookingCategory.INSTITUTE


def test_own_checker_detects_lunch_straddle():
    """own_checker flags H9 when a session crosses lunch."""
    raw_data = {
        "rooms": [{"id": "LH-1", "name": "LH 1", "type": "lecture_hall", "capacity": 100, "accessible": True}],
        "faculty": [{"id": "F01", "name": "Prof A", "department": "CS"}],
        "groups": [{"id": "CS-1", "name": "CS Year 1", "department": "CS", "year": 1, "size": 60}],
        "sessions": [{
            "id": "S1", "course_code": "CS101", "session_type": "lecture",
            "group_id": "CS-1", "faculty_id": "F01", "room_type": "lecture_hall",
            "size": 60, "duration": 2
        }],
    }
    # Placed starting at P5 with duration 2 (straddles lunch into P6)
    schedule = {
        "timetable": [{
            "session_id": "S1", "course_code": "CS101", "session_type": "lecture",
            "group_id": "CS-1", "faculty_id": "F01", "room_id": "LH-1",
            "day": "Monday", "start_period": 5, "duration": 2
        }],
    }

    result = check_schedule(raw_data, schedule)
    assert result["is_valid"] is False
    rules = [v["rule"] for v in result["hard_violations"]]
    assert "H9" in rules


def test_own_checker_detects_room_capacity_violation():
    """own_checker flags H5 when room capacity is less than session size."""
    raw_data = {
        "rooms": [{"id": "CR-101", "name": "Room 101", "type": "classroom", "capacity": 40, "accessible": True}],
        "faculty": [{"id": "F01", "name": "Prof A", "department": "CS"}],
        "groups": [{"id": "CS-1", "name": "CS Year 1", "department": "CS", "year": 1, "size": 60}],
        "sessions": [{
            "id": "S1", "course_code": "CS101", "session_type": "lecture",
            "group_id": "CS-1", "faculty_id": "F01", "room_type": "classroom",
            "size": 60, "duration": 1
        }],
    }
    schedule = {
        "timetable": [{
            "session_id": "S1", "course_code": "CS101", "session_type": "lecture",
            "group_id": "CS-1", "faculty_id": "F01", "room_id": "CR-101",
            "day": "Monday", "start_period": 1, "duration": 1
        }],
    }

    result = check_schedule(raw_data, schedule)
    assert result["is_valid"] is False
    rules = [v["rule"] for v in result["hard_violations"]]
    assert "H5" in rules
