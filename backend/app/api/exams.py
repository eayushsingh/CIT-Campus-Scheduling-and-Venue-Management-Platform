"""Exams API router: view and generate midsem exam schedule."""

from typing import Annotated, Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException

from backend.app.core.security import get_current_user
from backend.app.core.roles import Role, require_roles
from backend.app.services.schedule_service import generate_full_schedule
import backend.app.services.schedule_service as sched_svc

router = APIRouter(prefix="/api/exams", tags=["exams"])


@router.get("/")
async def get_exams():
    """Get the current generated midsem exams schedule."""
    sched = sched_svc.get_or_load_schedule()
    if sched is None:
        return {
            "status": "not_generated",
            "exams": [],
            "message": "No exams schedule has been generated yet.",
        }

    return {
        "status": "ready",
        "exams": sched.get("exams", []),
        "exam_soft_penalty": sched_svc._CURRENT_REPORT_CACHE.get("exam_soft_penalty", 0) if sched_svc._CURRENT_REPORT_CACHE else 0,
    }
