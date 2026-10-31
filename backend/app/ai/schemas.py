"""Pydantic schemas for AI layer outputs."""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class WindowDraft(BaseModel):
    day: str
    from_period: int
    to_period: int


class BookingDraft(BaseModel):
    title: str = "Venue Booking"
    category: str = "club_event"
    attendance: int = 50
    duration_periods: int = 1
    windows: List[WindowDraft] = Field(default_factory=list)
    room_types: List[str] = Field(default_factory=lambda: ["classroom", "lecture_hall", "seminar_hall"])
    needs: List[str] = Field(default_factory=list)
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = Field(default_factory=list)
    assumptions: List[str] = Field(default_factory=list)
    follow_up: Optional[str] = None
    confidence: float = 1.0


class DisruptionIntent(BaseModel):
    action: str  # faculty_unavailable, move_session, extra_session
    faculty_id: Optional[str] = None
    day: Optional[str] = None
    periods: List[int] = Field(default_factory=list)
    session_id: Optional[str] = None
    reason: str = ""
    target_day: Optional[str] = None
    target_period: Optional[int] = None

