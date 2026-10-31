"""Dataset loader for CIT scheduling data."""

import json
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
            building=r.get("building"),
            type=r["type"],
            capacity=r["capacity"],
            features=r.get("features", []),
            accessible=r.get("accessible", True),
            allowed_uses=r.get("allowed_uses", []),
        )
        rooms[room.id] = room

    faculty: Dict[str, Faculty] = {}
    for f in raw.get("faculty", []):
        fac = Faculty(
            id=f["id"],
            name=f["name"],
            department=f["department"],
            max_hours_per_day=f.get("max_hours_per_day", 4),
            needs_accessible=f.get("needs_accessible", False),
            unavailable=f.get("unavailable", []),
            preferences=f.get("preferences", []),
        )
        faculty[fac.id] = fac

    groups: Dict[str, StudentGroup] = {}
    raw_groups = raw.get("student_groups", []) or raw.get("groups", [])
    for g in raw_groups:
        grp = StudentGroup(
            id=g["id"],
            name=g.get("name", g["id"]),
            department=g["department"],
            year=g["year"],
            size=g["size"],
            needs_accessible=g.get("needs_accessible", False),
        )
        groups[grp.id] = grp

    courses: Dict[str, Course] = {}
    for c in raw.get("courses", []):
        crs = Course(
            id=c["id"],
            title=c["title"],
            department=c["department"],
            year=c.get("year", 1),
            lecture_hours=c.get("lecture_hours", 0),
            tutorial_hours=c.get("tutorial_hours", 0),
            lab_blocks=c.get("lab_blocks", 0),
        )
        courses[crs.id] = crs

    sessions: Dict[str, Session] = {}
    for s in raw.get("sessions", []):
        sess = Session(
            id=s["id"],
            course_id=s["course_id"],
            kind=s.get("kind", "lecture"),
            groups=s.get("groups", []),
            faculty_id=s["faculty_id"],
            size=s["size"],
            duration=s.get("duration", 1),
            room_types=s.get("room_types", []),
            needs_accessible=s.get("needs_accessible", False),
            basket_slot=s.get("basket_slot"),
            fixed_slot=s.get("fixed_slot"),
        )
        sessions[sess.id] = sess

    raw_cancellations = raw.get("cancellations", [])
    cancellations = set()
    for item in raw_cancellations:
        if isinstance(item, dict):
            cancellations.add(item.get("request_id"))
        elif isinstance(item, str):
            cancellations.add(item)

    bookings: Dict[str, BookingRequest] = {}
    for b in raw.get("booking_requests", []):
        windows = [
            BookingWindow(
                day=w["day"],
                from_period=w["from_period"],
                to_period=w["to_period"],
            )
            for w in b.get("windows", [])
        ]
        breq = BookingRequest(
            id=b["id"],
            submitted_at=b["submitted_at"],
            requester=b["requester"],
            role=b["role"],
            department=b.get("department"),
            requested_category=b["requested_category"],
            title=b["title"],
            attendance=b["attendance"],
            duration_periods=b["duration_periods"],
            windows=windows,
            room_types=b.get("room_types", []),
            needs=b.get("needs", []),
            requested_room=b.get("requested_room"),
            mandatory_for_groups=b.get("mandatory_for_groups", []),
            series_id=b.get("series_id"),
            raw_text=b.get("raw_text", ""),
            cancelled=(b["id"] in cancellations),
        )
        bookings[breq.id] = breq

    exams: Dict[str, Exam] = {}
    for e in raw.get("exams", []):
        ex = Exam(
            id=e["id"],
            course_ids=e.get("course_ids", []),
            groups=e.get("groups", []),
            size=e["size"],
            duration_hours=e.get("duration_hours", 2),
        )
        exams[ex.id] = ex

    return rooms, faculty, groups, courses, sessions, bookings, exams
