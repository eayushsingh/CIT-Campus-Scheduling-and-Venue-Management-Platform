"""Data sanity test: verify exact entity counts against cit_public.json."""

import pytest
from backend.app.data.loader import load_raw_dataset, parse_dataset
from backend.app.validation.official_validator import run_official_validator


def test_cit_public_sanity_counts():
    """Verify exact counts required by Phase 0 / Phase 1:
    27 rooms, 40 faculty, 14 groups, 62 courses, 189 sessions (243 hours),
    25 booking requests (BR-04 cancelled), 41 midsem exams.
    """
    raw = load_raw_dataset()
    rooms, faculty, groups, courses, sessions, bookings, exams = parse_dataset(raw)

    assert len(rooms) == 27, f"Expected 27 rooms, got {len(rooms)}"
    assert len(faculty) == 40, f"Expected 40 faculty, got {len(faculty)}"
    assert len(groups) == 14, f"Expected 14 groups, got {len(groups)}"
    assert len(courses) == 62, f"Expected 62 courses, got {len(courses)}"
    assert len(sessions) == 189, f"Expected 189 sessions, got {len(sessions)}"

    total_hours = sum(s.duration for s in sessions.values())
    assert total_hours == 243, f"Expected 243 teaching hours, got {total_hours}"

    assert len(bookings) == 25, f"Expected 25 booking requests, got {len(bookings)}"
    assert bookings["BR-04"].cancelled is True, "BR-04 must be marked as cancelled"

    assert len(exams) == 41, f"Expected 41 midsem exams, got {len(exams)}"


def test_official_validator_on_example():
    """Run official validator on schedule.example.json to verify wrapper integrity."""
    from backend.app.data.loader import find_data_file
    raw = load_raw_dataset()
    import json
    example_path = find_data_file("schedule.example.json")
    with open(example_path) as f:
        sched = json.load(f)

    res = run_official_validator(raw, sched)
    assert "hard_violations" in res
    assert "soft_penalty" in res
    # Example schedule is partial so it has hard violations (unscheduled sessions)
    assert res["hard_count"] > 0
