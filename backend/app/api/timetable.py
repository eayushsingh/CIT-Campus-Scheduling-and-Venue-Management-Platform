"""Timetable router - stub for Phase 1."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


@router.get("/")
async def get_timetable():
    """Get the current timetable. Placeholder."""
    return {"status": "not_generated", "message": "Timetable solver not yet implemented."}

