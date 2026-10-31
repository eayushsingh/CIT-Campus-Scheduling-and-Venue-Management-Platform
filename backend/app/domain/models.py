"""Typed domain models for CIT campus scheduling and venue management."""

from enum import Enum
from typing import List, Dict, Optional, Set, Any
from pydantic import BaseModel, Field


class RoomType(str, Enum):
    CLASSROOM = "classroom"
    LECTURE_HALL = "lecture_hall"
    AUDITORIUM = "auditorium"
    SEMINAR_HALL = "seminar_hall"
    OUTDOOR = "outdoor"
    LAB_CS = "lab_cs"
    LAB_ELEC = "lab_elec"
    LAB_PHY = "lab_phy"
    WORKSHOP = "workshop"
    LAB_CIVIL = "lab_civil"


class BookingCategory(str, Enum):
    INSTITUTE = "institute"
    GUEST_LECTURE = "guest_lecture"
    DEPARTMENT = "department"
    CLUB = "club"


CATEGORY_PRIORITY: Dict[BookingCategory, int] = {
    BookingCategory.INSTITUTE: 1,
    BookingCategory.GUEST_LECTURE: 2,
    BookingCategory.DEPARTMENT: 3,
    BookingCategory.CLUB: 4,
}

CATEGORY_WEIGHTS: Dict[BookingCategory, int] = {
    BookingCategory.INSTITUTE: 5,
    BookingCategory.GUEST_LECTURE: 4,
    BookingCategory.DEPARTMENT: 3,
    BookingCategory.CLUB: 2,
}

ROLE_CATEGORY_CAPS: Dict[str, BookingCategory] = {
    "admin": BookingCategory.INSTITUTE,
    "coordinator": BookingCategory.DEPARTMENT,
    "faculty": BookingCategory.GUEST_LECTURE,
    "club_rep": BookingCategory.CLUB,
}


class Room(BaseModel):
    id: str
    name: str
    type: str  # maps to RoomType values
    capacity: int
    features: List[str] = Field(default_factory=list)  # pa_system, projector, stage, computers, etc.
    accessible: bool = True
    allowed_uses: List[str] = Field(default_factory=lambda: ["teaching", "event", "exam"])
    maintenance_slots: List[Dict[str, Any]] = Field(default_factory=list)  # [{"day": "Thursday", "period": 1}]


class Faculty(BaseModel):
    id: str
    name: str
    department: str
    unavailable_slots: List[Dict[str, Any]] = Field(default_factory=list)  # [{"day": "Friday", "period": 1}]
    avoid_times: List[Dict[str, Any]] = Field(default_factory=list)        # [{"day": "Monday", "period": 9}]
    max_daily_hours: int = 4


class StudentGroup(BaseModel):
    id: str
    name: str
    department: str
    year: int
    size: int


class Course(BaseModel):
    code: str
    title: str
    department: str
    basket_id: Optional[str] = None  # e.g. OEB-1, OEB-2, OEB-3


class Session(BaseModel):
    id: str
    course_code: str
    session_type: str  # lecture, tutorial, lab
    group_id: str
    faculty_id: str
    room_type: str
    size: int
    duration: int = 1  # 1 for lecture/tutorial, 3 for lab
    requires_accessible: bool = False
    is_fixed: bool = False
    fixed_day: Optional[str] = None
    fixed_period: Optional[int] = None
    fixed_room: Optional[str] = None
    basket_id: Optional[str] = None
    enrolled_groups: List[str] = Field(default_factory=list)  # for combined lectures e.g. ID101-ALL-L1


class ScheduledSession(BaseModel):
    session_id: str
    course_code: str
    session_type: str
    group_id: str
    faculty_id: str
    room_id: str
    day: str
    start_period: int
    duration: int


class Exam(BaseModel):
    exam_id: str
    course_code: str
    group_id: str
    size: int


class ScheduledExam(BaseModel):
    exam_id: str
    course_code: str
    group_id: str
    room_ids: List[str]
    slot: str  # e.g. MON-AM
    day: str
    period: str  # AM or PM
    size: int


class BookingWindow(BaseModel):
    day: str
    start_period: int
    end_period: int


class BookingRequest(BaseModel):
    request_id: str
    title: str
    category: str  # institute, guest_lecture, department, club
    requested_room: Optional[str] = None
    room_types: List[str] = Field(default_factory=list)
    attendance: int
    duration_periods: int
    windows: List[BookingWindow] = Field(default_factory=list)
    needs: List[str] = Field(default_factory=list)
    accessible: bool = False
    mandatory_for_groups: List[str] = Field(default_factory=list)
    submitted_at: str
    cancelled: bool = False


class BookingDecision(BaseModel):
    request_id: str
    title: str
    category: str
    status: str  # approved, rejected, alternative_offered
    assigned_room: Optional[str] = None
    assigned_day: Optional[str] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    reason: str
    alternatives: List[Dict[str, Any]] = Field(default_factory=list)


class DisruptionType(str, Enum):
    FACULTY_UNAVAILABLE = "faculty_unavailable"
    ROOM_UNAVAILABLE = "room_unavailable"
    ADD_FACULTY = "add_faculty"
    ADD_SESSION = "add_session"
    REMOVE_SESSION = "remove_session"


class DisruptionItem(BaseModel):
    type: str
    faculty_id: Optional[str] = None
    room_id: Optional[str] = None
    day: Optional[str] = None
    period: Optional[int] = None
    session: Optional[Dict[str, Any]] = None
    session_id: Optional[str] = None
