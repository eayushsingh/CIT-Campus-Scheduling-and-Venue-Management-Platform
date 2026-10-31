"""Orchestration service for generating and validating complete CIT schedules."""

from typing import Dict, Any, Optional, Tuple
import json
from pathlib import Path

from backend.app.data.loader import load_raw_dataset, find_data_file
from backend.app.solver.timetable import generate_timetable
from backend.app.solver.exams import generate_exams
from backend.app.booking.engine import BookingEngine
from backend.app.validation.official_validator import run_official_validator
from backend.app.core.logging import get_logger

logger = get_logger("services.schedule")

_CURRENT_SCHEDULE_CACHE: Optional[Dict[str, Any]] = None
_CURRENT_REPORT_CACHE: Optional[Dict[str, Any]] = None


def get_or_load_schedule() -> Optional[Dict[str, Any]]:
    """Return the cached schedule, or load from exports/schedule.json if available."""
    global _CURRENT_SCHEDULE_CACHE, _CURRENT_REPORT_CACHE
    if _CURRENT_SCHEDULE_CACHE is not None:
        return _CURRENT_SCHEDULE_CACHE

    export_path = Path("exports/schedule.json")
    if export_path.exists():
        try:
            with open(export_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                _CURRENT_SCHEDULE_CACHE = data
                raw_data = load_raw_dataset()
                _CURRENT_REPORT_CACHE = run_official_validator(raw_data, data)
                logger.info("Loaded baseline schedule from exports/schedule.json")
                return _CURRENT_SCHEDULE_CACHE
        except Exception as e:
            logger.warning(f"Could not load exports/schedule.json: {e}")
    return None


def generate_full_schedule(
    raw_data: Optional[Dict[str, Any]] = None,
    time_limit_seconds: int = 20,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Generate a complete schedule (timetable, exams, fest_week bookings) and validate it.

    Returns:
        (schedule_dict, validator_report_dict)
    """
    global _CURRENT_SCHEDULE_CACHE, _CURRENT_REPORT_CACHE

    if raw_data is None:
        raw_data = load_raw_dataset()

    logger.info("Step 1: Planning preliminary reservations from booking engine")
    planner = BookingEngine(raw_data)
    reservations = planner.plan_preliminary_reservations()

    logger.info("Step 2: Solving weekly teaching timetable with CP-SAT")
    sessions = generate_timetable(raw_data, reservations=reservations, time_limit_seconds=time_limit_seconds)
    if not sessions:
        raise RuntimeError("Failed to generate feasible timetable schedule")

    logger.info("Step 3: Solving midsem exams schedule with CP-SAT")
    exams = generate_exams(raw_data, time_limit_seconds=time_limit_seconds)
    if not exams:
        raise RuntimeError("Failed to generate feasible exams schedule")

    logger.info("Step 4: Solving Spectra week venue bookings")
    engine = BookingEngine(raw_data, timetable_sessions=sessions)
    fest_week = engine.solve_bookings()

    schedule: Dict[str, Any] = {
        "dataset_id": raw_data.get("dataset_id", "cit-public-v1"),
        "team": "CIT Automated Solver",
        "sessions": sessions,
        "fest_week": fest_week,
        "exams": exams,
    }

    logger.info("Step 5: Executing official validator.py")
    report = run_official_validator(raw_data, schedule)

    # Check for hard violations
    if report.get("hard_count", 0) > 0:
        logger.error(f"Generated schedule has {report['hard_count']} hard violations: {report.get('hard_violations')}")
        raise ValueError(f"Generated schedule failed validation with {report['hard_count']} hard violations")

    _CURRENT_SCHEDULE_CACHE = schedule
    _CURRENT_REPORT_CACHE = report

    logger.info(
        f"Schedule generated successfully! Hard violations: {report['hard_count']}, "
        f"Soft penalty: {report['soft_total']}, Booking score: {report.get('bookings', {}).get('booking_score')}"
    )

    return schedule, report


def export_schedule_to_file(target_path: Optional[str] = None) -> Path:
    """Export the current validated schedule to exports/schedule.json."""
    if _CURRENT_SCHEDULE_CACHE is None:
        schedule, report = generate_full_schedule()
    else:
        schedule = _CURRENT_SCHEDULE_CACHE
        report = _CURRENT_REPORT_CACHE

    if target_path is None:
        export_file = find_data_file("schedule.json")
        # Ensure it points to exports/schedule.json
        exports_dir = Path("exports").resolve()
        exports_dir.mkdir(parents=True, exist_ok=True)
        export_file = exports_dir / "schedule.json"
    else:
        export_file = Path(target_path).resolve()
        export_file.parent.mkdir(parents=True, exist_ok=True)

    with open(export_file, "w", encoding="utf-8") as f:
        json.dump(schedule, f, indent=2)

    logger.info(f"Exported validated schedule to {export_file}")
    return export_file
