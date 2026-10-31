"""Authentication router: login, me, demo accounts."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.core.security import (
    verify_password,
    create_access_token,
    get_current_user,
)
from backend.app.db.models import User
from backend.app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    username: str
    display_name: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str
    role: str
    department: str | None


class DemoAccount(BaseModel):
    username: str
    password: str
    role: str
    display_name: str


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: Session = Depends(get_db),
):
    """Authenticate user and return JWT token."""
    user = db.query(User).filter_by(username=form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "INVALID_CREDENTIALS",
                "message": "Incorrect username or password.",
                "details": None,
            },
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(
        data={
            "sub": str(user.id),
            "username": user.username,
            "role": user.role,
        }
    )
    return TokenResponse(
        access_token=token,
        role=user.role,
        username=user.username,
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(
    current_user: Annotated[dict, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    """Get the currently authenticated user's profile."""
    user = db.query(User).filter_by(id=current_user["id"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        role=user.role,
        department=user.department,
    )


@router.get("/demo-accounts", response_model=list[DemoAccount])
async def get_demo_accounts():
    """Return demo account credentials for one-click login."""
    from backend.app.db.seed import DEMO_USERS
    return [
        DemoAccount(
            username=u["username"],
            password=u["password"],
            role=u["role"],
            display_name=u["display_name"],
        )
        for u in DEMO_USERS
    ]

