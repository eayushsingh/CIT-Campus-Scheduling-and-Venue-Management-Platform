"""AI Assistant API router."""

from typing import Annotated, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.app.core.security import get_current_user
from backend.app.ai.booking_parser import parse_booking_prompt
from backend.app.ai.faculty_assistant import handle_faculty_request
from backend.app.ai.explainer import explain_decision
from backend.app.ai.llm_client import get_llm_client, NullLLM

router = APIRouter(prefix="/api/assistant", tags=["assistant"])


class ParseBookingRequest(BaseModel):
    text: str
    current_weekday: Optional[str] = "MON"


class FacultyChatRequest(BaseModel):
    text: str
    faculty_id: Optional[str] = "F01"


class ExplainRequest(BaseModel):
    facts: Dict[str, Any]


@router.get("/status")
async def assistant_status():
    """Check AI assistant configuration and offline fallback status."""
    client = get_llm_client()
    is_null = isinstance(client, NullLLM)
    return {
        "llm_online": not is_null,
        "engine": "NullLLM (Offline Rule-Based Fallback Active)" if is_null else "Gemini 2.0 Flash",
        "description": "Deterministic safety rules enforce zero validity checks in LLM.",
    }


@router.post("/parse-booking")
async def api_parse_booking(
    body: ParseBookingRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Parse natural language booking text into an editable BookingDraft."""
    user_role = current_user.get("role", "club_rep")
    result = await parse_booking_prompt(
        text=body.text,
        user_role=user_role,
        current_weekday=body.current_weekday or "MON",
    )
    return result


@router.post("/faculty-request")
async def api_faculty_request(
    body: FacultyChatRequest,
    current_user: Annotated[dict, Depends(get_current_user)],
):
    """Process natural language faculty request into a disruption proposal or explanation."""
    fac_id = body.faculty_id or "F01"
    result = await handle_faculty_request(body.text, faculty_id=fac_id)
    return result


@router.post("/explain")
async def api_explain(body: ExplainRequest):
    """Explain a scheduling decision or booking rejection from structured facts."""
    explanation = await explain_decision(body.facts)
    return {"explanation": explanation}
