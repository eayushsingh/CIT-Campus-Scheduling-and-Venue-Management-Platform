"""Dataset loader for CIT scheduling data."""

import json
import os
from typing import Dict, Any, Tuple
from pathlib import Path

from backend.app.domain.models import (
    Room,
    Faculty,
    StudentGroup,
    Course,
    Session,
    Exam,
    BookingRequest,
    BookingWindow,
)
from backend.app.core.logging import get_logger

logger = get_logger("data.loader")


def find_data_file(filename: str) -> Path:
    """Find a data file in standard repository locations."""
    candidates = [
        Path(f"data/{filename}"),
        Path(f"../data/{filename}"),
        Path(f"../../data/{filename}"),
        Path(filename),
        Path(f"/app/data/{filename}"),
    ]
    for p in candidates:
        if p.exists() and p.is_file():
            return p.resolve()
    # If not found, return default path
    return Path(f"data/{filename}").resolve()


def load_raw_dataset(path: str | Path | None = None) -> Dict[str, Any]:
    """Load the raw JSON dataset."""
    if path is None:
        target_path = find_data_file("cit_public.json")
    else:
        target_path = Path(path)

    if not target_path.exists():
        raise FileNotFoundError(f"CIT dataset not found at {target_path}")

    with open(target_path, "r", encoding="utf-8") as f:
        return json.load(f)


def parse_dataset(raw: Dict[str, Any]) -> Tuple[
    Dict[str, Room],
    Dict[str, Faculty],
    Dict[str, StudentGroup],
    Dict[str, Course],
    Dict[str, Session],
    Dict[str, BookingRequest],
    Dict[str, Exam],
]:
    """Parse raw dictionary into typed domain model dictionaries."""
    rooms: Dict[str, Room] = {}
    for r in raw.get("rooms", []):
        room = Room(
            id=r["id"],
            name=r.get("name", r["id"]),
            type=r["type"],
            capacity=r["capacity"],
            features=r.get("features", []),
            accessible=r.get("accessible", True),
            allowed_uses=r.get("allowed_uses", ["teaching", "event", "exam"]),
            maintenance_slots=r.get("maintenance_slots", []),
        )
        rooms[room.id] = room

    faculty: Dict[str, Faculty] = {}
    for f in raw.get("faculty", []):
        fac = Faculty(
            id=f["id"],
            name=f["name"],
            department=f["department"],
            unavailable_slots=f.get("unavailable_slots", []),
            avoid_times=f.get("avoid_times", []),
            max_daily_hours=f.get("max_daily_hours", 4),
        )
        faculty[fac.id] = fac

    groups: Dict[str, StudentGroup] = {}
    for g in raw.get("groups", []):
        grp = StudentGroup(
            id=g["id"],
            name=g.get("name", g["id"]),
            department=g["department"],
            year=g["year"],
            size=g["size"],
        )
        groups[grp.id] = grp

    courses: Dict[str, Course] = {}
    for c in raw.get("courses", []):
        crs = Course(
            code=c["code"],
            title=c["title"],
            department=c["department"],
            basket_id=c.get("basket_id"),
        )
        courses[crs.code] = crs

    sessions: Dict[str, Session] = {}
    for s in raw.get("sessions", []):
        sess = Session(
            id=s["id"],
            course_code=s["course_code"],
            session_type=s.get("session_type", "lecture"),
            group_id=s["group_id"],
            faculty_id=s["faculty_id"],
            room_type=s["room_type"],
            size=s["size"],
            duration=s.get("duration", 1),
            requires_accessible=s.get("requires_accessible", False),
            is_fixed=s.get("is_fixed", False),
            fixed_day=s.get("fixed_day"),
            fixed_period=s.get("fixed_period"),
            fixed_room=s.get("fixed_room"),
            basket_id=s.get("basket_id"),
            enrolled_groups=s.get("enrolled_groups", [s["group_id"]]),
        )
        sessions[sess.id] = sess

    bookings: Dict[str, BookingRequest] = {}
    for b in raw.get("booking_requests", []):
        windows = [
            BookingWindow(
                day=w["day"],
                start_period=w["start_period"],
                end_period=w["end_period"],
            )
            for w in b.get("windows", [])
        ]
        breq = BookingRequest(
            request_id=b["request_id"],
            title=b["title"],
            category=b["category"],
            requested_room=b.get("requested_room"),
            room_types=b.get("room_types", []),
            attendance=b["attendance"],
            duration_periods=b["duration_periods"],
            windows=windows,
            needs=b.get("needs", []),
            accessible=b.get("accessible", False),
            mandatory_for_groups=b.get("mandatory_for_groups", []),
            submitted_at=b["submitted_at"],
            cancelled=b.get("cancelled", False),
        )
        bookings[breq.request_id] = breq

    exams: Dict[str, Exam] = {}
    for e in raw.get("exams", []):
        ex = Exam(
            exam_id=e["exam_id"],
            course_code=e["course_code"],
            group_id=e["group_id"],
            size=e["size"],
        )
        exams[ex.exam_id] = ex

    return rooms, faculty, groups, courses, sessions, bookings, exams
