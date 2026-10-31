"""Security guardrails and sanity checks for AI outputs."""

import re
from typing import Dict, Any, List
from backend.app.domain.models import ROLE_CATEGORY_CAPS

INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|prior)\s+instructions",
    r"i\s+am\s+the\s+dean",
    r"as\s+the\s+director",
    r"system\s*prompt",
    r"bypass\s+rules",
    r"override\s+priority",
    r"make\s+this\s+highest\s+priority",
]


def sanitize_input_text(text: str) -> str:
    """Strip or neutralize prompt injection attempts and excessive characters."""
    sanitized = text[:1000]  # Input length guardrail
    for pattern in INJECTION_PATTERNS:
        sanitized = re.sub(pattern, "[REDACTED_INJECTION_ATTEMPT]", sanitized, flags=re.IGNORECASE)
    return sanitized


def apply_role_guardrail(draft: Dict[str, Any], user_role: str) -> Dict[str, Any]:
    """Strictly override requested category based on authenticated user role cap."""
    cap = ROLE_CATEGORY_CAPS.get(user_role, "club_event")
    p_order = ["institute_event", "guest_lecture", "department_event", "club_event"]

    req_cat = draft.get("category")
    if not req_cat or req_cat == "club_event":
        # Default to the user's authorized role category
        draft["category"] = cap
        return draft

    req_idx = p_order.index(req_cat) if req_cat in p_order else 3
    cap_idx = p_order.index(cap) if cap in p_order else 3

    effective_cat = p_order[max(req_idx, cap_idx)]
    draft["category"] = effective_cat
    return draft


def apply_accessibility_guardrail(draft: Dict[str, Any]) -> Dict[str, Any]:
    """If user asks for a non-accessible room with accessibility need, replace with accessible room."""
    req_room = draft.get("requested_room")
    needs = set(draft.get("needs", []))
    is_accessible_needed = "accessible" in needs or "wheelchair" in needs

    if is_accessible_needed:
        # Non-accessible rooms on CIT campus: SH-2, CR-201..203, CR-301..303
        if req_room == "SH-2":
            draft["requested_room"] = "SH-1"
            draft.setdefault("assumptions", []).append("SH-2 is not wheelchair accessible; redirected preference to SH-1.")
        elif req_room and (req_room.startswith("CR-2") or req_room.startswith("CR-3")):
            ground_alt = "CR-1" + req_room[4:] if len(req_room) > 4 else "CR-101"
            draft["requested_room"] = ground_alt
            draft.setdefault("assumptions", []).append(f"{req_room} is on an upper floor without lift; redirected preference to {ground_alt}.")

    return draft
