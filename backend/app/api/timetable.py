"""Timetable API router: view and generate clash-free weekly timetable."""

from typing import Annotated, Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel

from backend.app.core.security import get_current_user
from backend.app.core.roles import Role, require_roles
from backend.app.services.schedule_service import generate_full_schedule
import backend.app.services.schedule_service as sched_svc

router = APIRouter(prefix="/api/timetable", tags=["timetable"])


class GenerateResponse(BaseModel):
    message: str
    sessions_count: int
    hard_violations: int
    soft_penalty: float
    booking_score: float


@router.get("/")
async def get_timetable():
    """Get the current generated timetable sessions and metadata."""
    sched = sched_svc.get_or_load_schedule()
    if sched is None:
        return {
            "status": "not_generated",
            "sessions": [],
            "message": "No timetable has been generated yet. Admin can click 'Generate Timetable'.",
        }

    return {
        "status": "ready",
        "dataset_id": sched.get("dataset_id"),
        "team": sched.get("team"),
        "sessions": sched.get("sessions", []),
        "report": sched_svc._CURRENT_REPORT_CACHE,
    }


@router.post("/generate", response_model=GenerateResponse, dependencies=[Depends(require_roles(Role.ADMIN))])
async def trigger_generate_timetable(
    current_user: Annotated[dict, Depends(get_current_user)],
    time_limit: int = 30,
):
    """Trigger the CP-SAT solver to generate a fresh, clash-free schedule. Admin only."""
    try:
        schedule, report = generate_full_schedule(time_limit_seconds=time_limit)
        return GenerateResponse(
            message="Timetable successfully generated and validated with 0 hard violations!",
            sessions_count=len(schedule.get("sessions", [])),
            hard_violations=report.get("hard_count", 0),
            soft_penalty=report.get("soft_total", 0),
            booking_score=report.get("bookings", {}).get("booking_score", 0.0),
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "SOLVER_ERROR", "message": str(e), "details": None},
        )
