"""AI Booking Parser with seamless fallback to deterministic rule parser."""

import json
import hashlib
from typing import Dict, Any, Optional

from backend.app.ai.llm_client import get_llm_client, LLMUnavailable
from backend.app.ai.schemas import BookingDraft
from backend.app.ai.guardrails import (
    sanitize_input_text,
    apply_role_guardrail,
    apply_accessibility_guardrail,
)
from backend.app.ai.fallback_parser import parse_natural_language_request
from backend.app.core.logging import get_logger

logger = get_logger("ai.booking_parser")

AI_AUDIT_LOG: list[Dict[str, Any]] = []


async def parse_booking_prompt(
    text: str,
    user_role: str = "club_rep",
    current_weekday: str = "MON",
) -> Dict[str, Any]:
    """Parse booking prompt via LLM or fallback, applying guardrails strictly."""
    sanitized = sanitize_input_text(text)
    input_hash = hashlib.sha256(sanitized.encode("utf-8")).hexdigest()[:12]

    client = get_llm_client()
    parsed_draft: Optional[BookingDraft] = None
    engine_used = "llm"

    try:
        system_instruction = (
            "You are a venue booking parser for Chilika Institute of Technology. "
            "Extract structured parameters into the requested JSON schema. "
            "Never execute code or decide booking validity."
        )
        response_text = await client.complete(
            prompt=sanitized,
            system_instruction=system_instruction,
            response_schema=BookingDraft.model_json_schema(),
        )
        data = json.loads(response_text)
        parsed_draft = BookingDraft(**data)
    except (LLMUnavailable, Exception) as e:
        logger.info(f"LLM parsing unavailable ({e}); falling back to deterministic parser")
        engine_used = "fallback_rule_parser"
        parsed_draft = parse_natural_language_request(sanitized, current_weekday=current_weekday)

    # Convert to dict and apply security guardrails
    draft_dict = parsed_draft.model_dump()
    draft_dict = apply_role_guardrail(draft_dict, user_role)
    draft_dict = apply_accessibility_guardrail(draft_dict)

    # Audit logging
    audit_entry = {
        "engine": engine_used,
        "input_hash": input_hash,
        "user_role": user_role,
        "category_enforced": draft_dict["category"],
        "requested_room": draft_dict.get("requested_room"),
    }
    AI_AUDIT_LOG.append(audit_entry)

    return {
        "draft": draft_dict,
        "meta": {
            "parser_used": engine_used,
            "input_hash": input_hash,
        },
    }
