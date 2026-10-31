"""Bookings API router: view requests, submit bookings, and review decisions."""

from typing import Annotated, Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.core.security import get_current_user
from backend.app.core.roles import Role, require_roles
from backend.app.data.loader import load_raw_dataset
from backend.app.domain.models import ROLE_CATEGORY_CAPS
from backend.app.booking.engine import BookingEngine, get_effective_category
import backend.app.services.schedule_service as sched_svc

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


class BookingSubmitRequest(BaseModel):
    title: str
    category: str
    attendance: int
    duration_periods: int
    day: str
    from_period: int
    to_period: int
    room_types: List[str]
    needs: List[str] = []
    requested_room: Optional[str] = None
    mandatory_for_groups: List[str] = []


@router.get("/")
async def list_bookings():
    """List all booking requests and their current decisions."""
    raw = load_raw_dataset()
    requests = raw.get("booking_requests", [])

    sched = sched_svc.get_or_load_schedule()
    decisions = []
    if sched:
        decisions = sched.get("fest_week", {}).get("bookings", [])
    dec_map = {d["request_id"]: d for d in decisions}

    enriched = []
    for r in requests:
        dec = dec_map.get(r["id"], {"status": "pending", "reason": "Awaiting timetable generation"})
        enriched.append({
            **r,
            "decision": dec,
        })

    booking_score = 0.0
    if sched_svc._CURRENT_REPORT_CACHE:
        booking_score = sched_svc._CURRENT_REPORT_CACHE.get("bookings", {}).get("booking_score", 0.0)

    return {
        "booking_requests": enriched,
        "booking_score": booking_score,
        "cancellations": raw.get("cancellations", []),
    }


@router.get("/available-rooms")
async def get_available_rooms(
    day: str = "MON",
    period: int = 1,
    capacity: int = 0,
    room_type: Optional[str] = None,
    accessible_only: bool = False,
):
    """Find rooms available at (day, period) matching capacity, type, and accessibility."""
    raw = load_raw_dataset()
    rooms = raw.get("rooms", [])

    # Check occupied rooms in current schedule
    occupied_rooms = set()
    if sched_svc._CURRENT_SCHEDULE_CACHE:
        # Check timetable sessions
        for s in sched_svc._CURRENT_SCHEDULE_CACHE.get("timetable", []):
            if s.get("day") == day:
                sp = s.get("start_period", 0)
                dur = 3 if "L" in s.get("session_id", "") and not s.get("session_id", "").endswith("-L1") else 1
                # Check course duration if available
                if sp <= period < sp + dur:
                    occupied_rooms.add(s.get("room"))
        # Check approved bookings
        for b in sched_svc._CURRENT_SCHEDULE_CACHE.get("fest_week", {}).get("bookings", []):
            if b.get("status") == "approved" and b.get("day") == day:
                sp = b.get("start_period", 0)
                dur = b.get("duration_periods", 1)
                if sp <= period < sp + dur:
                    occupied_rooms.add(b.get("allocated_room"))

    available = []
    for r in rooms:
        r_id = r["id"]
        if r_id in occupied_rooms:
            continue
        if capacity > 0 and r.get("capacity", 0) < capacity:
            continue
        if room_type and room_type != "all" and r.get("type") != room_type:
            continue
        if accessible_only and r.get("floor", 1) > 1:
            # SH-2 is on floor 2 and not wheelchair accessible
            continue
        available.append(r)

    # Sort by capacity ascending for best-fit
    available.sort(key=lambda x: x.get("capacity", 0))

    return {
        "day": day,
        "period": period,
        "total_available": len(available),
        "available_rooms": available,
    }


@router.post("/submit")
async def submit_booking(
    req: BookingSubmitRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Submit a new venue booking request. Enforces role category cap server-side."""
    user_role = current_user["role"]
    cap = ROLE_CATEGORY_CAPS.get(user_role, "club_event")

    raw_req = {
        "requested_category": req.category,
        "role": user_role,
    }
    raw_data = load_raw_dataset()
    eff_cat = get_effective_category(raw_req, raw_data)

    return {
        "message": "Booking request received and pending resolution.",
        "effective_category": eff_cat,
        "role_category_cap": cap,
        "details": req.model_dump(),
    }
