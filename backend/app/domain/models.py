"""Typed domain models matching cit_public.json and official validator.py."""

from enum import Enum
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

DAYS = ["MON", "TUE", "WED", "THU", "FRI"]
EXAM_DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT"]
EXAM_SESSIONS = ["AM", "PM"]

TEACHING_PERIODS = list(range(1, 10))  # P1..P9
EVENT_PERIODS = list(range(10, 14))    # P10..P13
ALL_PERIODS = list(range(1, 14))       # P1..P13

LAB_ALLOWED_START_PERIODS = [2, 6]     # P2 ends at P4; P6 ends at P8
LUNCH_PERIOD_BOUNDARY = 5              # Between P5 and P6


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
    INSTITUTE = "institute_event"
    GUEST_LECTURE = "guest_lecture"
    DEPARTMENT = "department_event"
    CLUB = "club_event"


CAT_WEIGHT: Dict[str, int] = {
    "institute_event": 5,
    "guest_lecture": 4,
    "department_event": 3,
    "club_event": 2,
}

ROLE_CATEGORY_CAPS: Dict[str, str] = {
    "admin": "institute_event",
    "department_coordinator": "department_event",
    "faculty": "guest_lecture",
    "club": "club_event",
    "coordinator": "department_event",
    "club_rep": "club_event",
}


class Room(BaseModel):
    id: str
    name: str
    building: Optional[str] = None
    type: str
    capacity: int
    features: List[str] = Field(default_factory=list)
    accessible: bool = True
    allowed_uses: List[str] = Field(default_factory=list)


class Faculty(BaseModel):
    id: str
    name: str
    department: str
    max_hours_per_day: int = 4
    needs_accessible: bool = False
    unavailable: List[Dict[str, Any]] = Field(default_factory=list)
    preferences: List[Dict[str, Any]] = Field(default_factory=list)


class StudentGroup(BaseModel):
    id: str
    name: str
    year: int
    department: str
    size: int
    needs_accessible: bool = False


class Course(BaseModel):
    id: str
    title: str
    department: str
    year: int
    lecture_hours: int = 0
    tutorial_hours: int = 0
    lab_blocks: int = 0


class Session(BaseModel):
    id: str
    course_id: str
    kind: str  # lecture, tutorial, lab
    groups: List[str]
    faculty_id: str
    size: int
    duration: int = 1
    room_types: List[str]
    needs_accessible: bool = False
    basket_slot: Optional[str] = None
    fixed_slot: Optional[Dict[str, Any]] = None  # {"day": "MON", "period": 1, "room_id": "AUD"}


class BookingWindow(BaseModel):
    day: str
    from_period: int
    to_period: int


class BookingRequest(BaseModel):
    id: str
    submitted_at: str
    requester: str
    role: str
    department: Optional[str] = None
    requested_category: str
    title: str
    attendance: int
    duration_periods: int
    windows: List[BookingWindow]
    room_types: List[str]
    needs: List[str]
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = Field(default_factory=list)
    series_id: Optional[str] = None
    raw_text: str = ""
    cancelled: bool = False


class Exam(BaseModel):
    id: str
    course_ids: List[str]
    groups: List[str]
    size: int
    duration_hours: int = 2


# --- Export Structures for schedule.json ---

class SessionAssignment(BaseModel):
    session_id: str
    day: str
    start_period: int
    room_id: str


class BookingDecisionExport(BaseModel):
    request_id: str
    status: str  # approved, rejected, alternative_offered
    day: Optional[str] = None
    start_period: Optional[int] = None
    end_period: Optional[int] = None
    room_id: Optional[str] = None
    reason: str


class SessionOverrideExport(BaseModel):
    session_id: str
    day: str
    start_period: int
    room_id: str
    displaced_by: str


class ExamAssignmentExport(BaseModel):
    exam_id: str
    day: str
    session: str  # AM or PM
    rooms: List[str]


class FestWeekExport(BaseModel):
    bookings: List[BookingDecisionExport] = Field(default_factory=list)
    session_overrides: List[SessionOverrideExport] = Field(default_factory=list)


class ScheduleExport(BaseModel):
    team: str = "CIT Automated Solver"
    dataset_id: str = "cit-public-v1"
    sessions: List[SessionAssignment] = Field(default_factory=list)
    fest_week: FestWeekExport = Field(default_factory=FestWeekExport)
    exams: List[ExamAssignmentExport] = Field(default_factory=list)
