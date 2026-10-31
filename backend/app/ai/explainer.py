"""Explanation generator for scheduling decisions and booking outcomes.

Architectural Rule:
The explanation is grounded strictly in code-generated facts.
If LLM is disabled or unavailable, template fallback generates the explanation directly.
"""

from typing import Dict, Any, Optional

from backend.app.ai.llm_client import get_llm_client, LLMUnavailable
from backend.app.core.logging import get_logger

logger = get_logger("ai.explainer")


async def explain_decision(facts: Dict[str, Any]) -> str:
    """Generate a clear explanation based on structured facts."""
    decision_type = facts.get("type", "booking_decision")

    # Template fallback
    if decision_type == "booking_decision":
        status = facts.get("status")
        req_id = facts.get("request_id")
        reason = facts.get("reason", "")
        if status == "approved":
            template = f"Booking '{req_id}' was approved: {reason}"
        elif status == "alternative_offered":
            template = f"Alternative offered for '{req_id}': {reason}"
        else:
            template = f"Booking '{req_id}' was rejected: {reason}"
    elif decision_type == "timetable_slot":
        sid = facts.get("session_id")
        day = facts.get("day")
        period = facts.get("period")
        room = facts.get("room_id")
        template = (
            f"Session '{sid}' is placed on {day} P{period} in {room} because "
            f"earlier slots conflict with faculty availability, student group classes, or room maintenance."
        )
    else:
        template = str(facts.get("reason", "Decision recorded according to institutional constraints."))

    client = get_llm_client()
    try:
        prompt = (
            f"Rephrase the following factual decision into a polite, professional, and concise sentence. "
            f"Do not invent facts or numbers. Facts: {facts}"
        )
        llm_text = await client.complete(prompt=prompt, temperature=0.1)
        if llm_text.strip():
            return llm_text.strip()
    except (LLMUnavailable, Exception):
        pass

    return template
