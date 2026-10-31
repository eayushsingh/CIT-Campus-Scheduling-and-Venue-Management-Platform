"""Role definitions and role-checking utilities."""

from enum import Enum
from typing import Annotated
from fastapi import Depends, HTTPException, status


class Role(str, Enum):
    ADMIN = "admin"
    COORDINATOR = "coordinator"
    FACULTY = "faculty"
    CLUB_REP = "club_rep"


# Human-readable labels
ROLE_LABELS: dict[Role, str] = {
    Role.ADMIN: "Admin",
    Role.COORDINATOR: "Department Coordinator",
    Role.FACULTY: "Faculty",
    Role.CLUB_REP: "Club Representative",
}


def require_roles(*allowed: Role):
    """Dependency that enforces server-side role checks.

    Usage:
        @router.get("/admin-only", dependencies=[Depends(require_roles(Role.ADMIN))])
    """
    from backend.app.core.security import get_current_user

    async def _check(current_user: Annotated[dict, Depends(get_current_user)]):
        user_role = Role(current_user["role"])
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "code": "FORBIDDEN",
                    "message": f"Role '{user_role.value}' is not authorised for this action.",
                    "details": {"required_roles": [r.value for r in allowed]},
                },
            )
        return current_user

    return _check

