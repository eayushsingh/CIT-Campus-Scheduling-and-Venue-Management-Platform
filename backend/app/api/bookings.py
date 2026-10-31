"""Bookings router - stub for Phase 2."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/bookings", tags=["bookings"])


@router.get("/")
async def get_bookings():
    """List booking requests. Placeholder."""
    return {"bookings": [], "message": "Booking engine not yet implemented."}

