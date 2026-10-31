"""Disruptions router - stub for Phase 3."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])


@router.get("/")
async def get_disruptions():
    """List disruption events. Placeholder."""
    return {"disruptions": [], "message": "Rescheduling not yet implemented."}

