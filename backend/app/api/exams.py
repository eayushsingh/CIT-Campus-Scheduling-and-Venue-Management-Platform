"""Exams router - stub for Phase 1."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.get("/")
async def get_exams():
    """Get the exam schedule. Placeholder."""
    return {"status": "not_generated", "message": "Exam scheduler not yet implemented."}

