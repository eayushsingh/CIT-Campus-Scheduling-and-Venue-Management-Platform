"""Disruptions API router: submit disruptions, preview diffs, and approve changes."""

from typing import Annotated, Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
import json

from backend.app.core.security import get_current_user
from backend.app.core.roles import Role, require_roles
from backend.app.data.loader import load_raw_dataset
from backend.app.solver.reschedule import reschedule
from backend.app.solver.infeasibility import explain_infeasible_disruption
import backend.app.services.schedule_service as sched_svc

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])

_PENDING_PROPOSAL: Optional[Dict[str, Any]] = None
_APPROVED_SCHEDULE_AFTER: Optional[Dict[str, Any]] = None
_AUDIT_LOG: List[Dict[str, Any]] = []


class ProposeDisruptionRequest(BaseModel):
    disruption: Dict[str, Any]


@router.get("/")
async def list_disruptions():
    """Get current pending proposal, approved schedule after, and audit log."""
    return {
        "pending_proposal": _PENDING_PROPOSAL,
        "has_approved_after": _APPROVED_SCHEDULE_AFTER is not None,
        "audit_log": _AUDIT_LOG,
    }


@router.post("/propose")
async def propose_disruption(
    body: ProposeDisruptionRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Compute minimal-move schedule repair and return diff without modifying current schedule."""
    global _PENDING_PROPOSAL

    raw_data = load_raw_dataset()
    base_sched = sched_svc._CURRENT_SCHEDULE_CACHE
    if not base_sched:
        # Generate initial schedule if not yet cached
        base_sched, _ = sched_svc.generate_full_schedule(raw_data)

    sched_after, summary = reschedule(raw_data, base_sched, body.disruption, time_limit_seconds=20)

    if not sched_after:
        explanation = explain_infeasible_disruption(raw_data, body.disruption)
        return {
            "status": "infeasible",
            "message": "Disruption cannot be accommodated without violating hard constraints.",
            "explanation": explanation,
            "details": summary,
        }

    _PENDING_PROPOSAL = {
        "disruption": body.disruption,
        "schedule_after": sched_after,
        "summary": summary,
        "proposed_by": current_user["username"],
    }

    return {
        "status": "feasible",
        "message": f"Repair computed: {summary.get('sessions_moved')} sessions moved.",
        "summary": summary,
    }


@router.post("/approve", dependencies=[Depends(require_roles(Role.ADMIN))])
async def approve_disruption(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Admin approval to atomically apply the pending disruption proposal."""
    global _PENDING_PROPOSAL, _APPROVED_SCHEDULE_AFTER, _AUDIT_LOG

    if not _PENDING_PROPOSAL:
        raise HTTPException(status_code=400, detail="No pending disruption proposal to approve.")

    _APPROVED_SCHEDULE_AFTER = _PENDING_PROPOSAL["schedule_after"]
    sched_svc._CURRENT_SCHEDULE_CACHE = _APPROVED_SCHEDULE_AFTER

    # Write schedule_after.json
    sched_svc.export_schedule_to_file("exports/schedule_after.json")

    audit_entry = {
        "action": "APPROVE_DISRUPTION",
        "user": current_user["username"],
        "sessions_moved": _PENDING_PROPOSAL["summary"].get("sessions_moved"),
        "hard_violations": _PENDING_PROPOSAL["summary"].get("hard_violations"),
        "timestamp": "2026-10-31T16:40:00Z",
    }
    _AUDIT_LOG.append(audit_entry)

    applied_summary = _PENDING_PROPOSAL["summary"]
    _PENDING_PROPOSAL = None

    return {
        "message": "Disruption successfully approved and atomically applied to active schedule.",
        "audit": audit_entry,
        "summary": applied_summary,
    }


@router.post("/reject", dependencies=[Depends(require_roles(Role.ADMIN))])
async def reject_disruption(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Admin rejection of the pending disruption proposal."""
    global _PENDING_PROPOSAL, _AUDIT_LOG
    if not _PENDING_PROPOSAL:
        raise HTTPException(status_code=400, detail="No pending proposal to reject.")

    _AUDIT_LOG.append({
        "action": "REJECT_DISRUPTION",
        "user": current_user["username"],
        "timestamp": "2026-10-31T16:40:00Z",
    })
    _PENDING_PROPOSAL = None
    return {"message": "Pending disruption proposal was rejected. No schedule changes applied."}
