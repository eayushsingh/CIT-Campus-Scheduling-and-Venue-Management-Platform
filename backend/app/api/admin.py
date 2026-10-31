"""Admin router: reset demo data, system health, etc."""

from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.app.core.security import get_current_user
from backend.app.core.roles import Role, require_roles

router = APIRouter(prefix="/api/admin", tags=["admin"])


class ResetResponse(BaseModel):
    message: str


@router.post(
    "/reset",
    response_model=ResetResponse,
    dependencies=[Depends(require_roles(Role.ADMIN))],
)
async def reset_demo_data(
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Reset all data to initial demo state. Admin only."""
    from backend.app.db.seed import reset_db
    reset_db()
    return ResetResponse(message="Demo data reset successfully.")

