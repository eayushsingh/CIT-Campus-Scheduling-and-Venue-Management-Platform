"""Export router - stub for Phase 1."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/schedule")
async def export_schedule():
    """Export schedule.json. Placeholder."""
    return {"message": "No schedule generated yet."}

