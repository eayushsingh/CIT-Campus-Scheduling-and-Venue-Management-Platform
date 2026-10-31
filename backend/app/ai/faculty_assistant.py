"""Faculty Assistant intent parser and proposal generator.

Converts natural language faculty requests (e.g. leave on Friday, move session)
into disruption proposals evaluated by the CP-SAT minimal-move solver.
"""

from typing import Dict, Any, Optional
import json

from backend.app.ai.llm_client import get_llm_client, LLMUnavailable
from backend.app.ai.schemas import DisruptionIntent
from backend.app.ai.guardrails import sanitize_input_text
from backend.app.data.loader import load_raw_dataset
from backend.app.solver.reschedule import reschedule
from backend.app.solver.infeasibility import explain_infeasible_disruption
import backend.app.services.schedule_service as sched_svc
from backend.app.core.logging import get_logger

logger = get_logger("ai.faculty_assistant")


def parse_faculty_intent_rule_based(text: str, faculty_id: str = "F01") -> DisruptionIntent:
    """Fallback rule-based intent parser for faculty requests."""
    lower = text.lower()
    day = "MON"
    if "monday" in lower: day = "MON"
    elif "tuesday" in lower: day = "TUE"
    elif "wednesday" in lower: day = "WED"
    elif "thursday" in lower: day = "THU"
    elif "friday" in lower: day = "FRI"

    if "leave" in lower or "unavailable" in lower or "not available" in lower:
        return DisruptionIntent(
            action="faculty_unavailable",
            faculty_id=faculty_id,
            day=day,
            periods=list(range(1, 10)),
            reason=text[:100],
        )

    return DisruptionIntent(
        action="faculty_unavailable",
        faculty_id=faculty_id,
        day=day,
        periods=list(range(1, 10)),
        reason="Leave request",
    )


async def handle_faculty_request(text: str, faculty_id: str = "F01") -> Dict[str, Any]:
    """Process faculty natural language request into a disruption proposal or explanation."""
    sanitized = sanitize_input_text(text)
    client = get_llm_client()

    intent: Optional[DisruptionIntent] = None
    try:
        sys_prompt = "Extract faculty schedule change intent into the given JSON schema."
        resp = await client.complete(
            prompt=sanitized,
            system_instruction=sys_prompt,
            response_schema=DisruptionIntent.model_json_schema(),
        )
        intent = DisruptionIntent(**json.loads(resp))
    except (LLMUnavailable, Exception):
        intent = parse_faculty_intent_rule_based(sanitized, faculty_id=faculty_id)

    # Convert intent to formal disruption structure
    disruption = {
        "id": f"faculty-req-{faculty_id}",
        "changes": [
            {
                "type": "faculty_unavailable",
                "faculty_id": faculty_id,
                "days": [intent.day or "MON"],
                "periods": intent.periods or list(range(1, 10)),
                "reason": intent.reason or "Faculty leave request",
            }
        ],
    }

    raw_data = load_raw_dataset()
    base_sched = sched_svc._CURRENT_SCHEDULE_CACHE
    if not base_sched:
        base_sched, _ = sched_svc.generate_full_schedule(raw_data)

    sched_after, summary = reschedule(raw_data, base_sched, disruption, time_limit_seconds=15)

    if not sched_after:
        explanation = explain_infeasible_disruption(raw_data, disruption)
        return {
            "status": "infeasible",
            "message": "Your leave request cannot be accommodated without clashing with mandatory classes.",
            "explanation": explanation,
        }

    return {
        "status": "feasible",
        "message": f"Proposal generated: {summary.get('sessions_moved')} sessions moved.",
        "summary": summary,
        "disruption": disruption,
    }
