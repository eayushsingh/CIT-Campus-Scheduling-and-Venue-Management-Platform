"""Export API router: download schedule.json and schedule_after.json."""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path
import json

import backend.app.services.schedule_service as sched_svc

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/schedule")
async def export_schedule():
    """Export and download schedule.json."""
    export_path = Path("exports/schedule.json").resolve()
    if not export_path.exists():
        # Trigger export
        try:
            sched_svc.export_schedule_to_file("exports/schedule.json")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to generate export: {str(e)}")

    return FileResponse(export_path, media_type="application/json", filename="schedule.json")


@router.get("/schedule_after")
async def export_schedule_after():
    """Export and download schedule_after.json."""
    export_path = Path("exports/schedule_after.json").resolve()
    if not export_path.exists():
        raise HTTPException(
            status_code=404,
            detail="schedule_after.json has not been generated yet. Please apply a disruption first.",
        )
    return FileResponse(export_path, media_type="application/json", filename="schedule_after.json")
