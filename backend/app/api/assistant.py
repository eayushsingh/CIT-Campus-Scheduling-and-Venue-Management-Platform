"""Assistant router - stub for Phase 4."""

from fastapi import APIRouter

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


@router.get("/status")
async def assistant_status():
    """Check if the AI assistant is available."""
    return {"available": False, "message": "AI assistant not yet implemented."}

