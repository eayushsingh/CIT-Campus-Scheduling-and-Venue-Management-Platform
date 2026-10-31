"""Wrapper around the official CIT validator (data/validator.py).

Rules:
- NEVER modify or edit validator.py.
- Import run() read-only.
- Format results into clean, typed Python dictionaries for consumption by API and tests.
"""

from typing import Dict, Any, Optional
import sys
from pathlib import Path

from backend.app.core.logging import get_logger
from backend.app.data.loader import find_data_file

logger = get_logger("validation.official")


def run_official_validator(
    data: Dict[str, Any],
    schedule: Dict[str, Any],
    baseline: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Execute the official validator.py run(data, sched, baseline) function.

    Returns structured output containing:
    - hard_violations: list of violation strings/dicts
    - hard_count: int
    - soft_penalty: float/int
    - soft_breakdown: dict
    - moved_sessions: int
    - booking_score: float
    - booking_breakdown: dict
    """
    validator_path = find_data_file("validator.py")

    if not validator_path.exists():
        logger.warning(f"Official validator not found at {validator_path}. Using fallback.")
        return {
            "hard_violations": ["Official validator file not found"],
            "hard_count": 1,
            "soft_penalty": 999,
            "soft_breakdown": {},
            "moved_sessions": 0,
            "booking_score": 0.0,
            "booking_breakdown": {},
        }

    # Add directory containing validator.py to sys.path if not present
    validator_dir = str(validator_path.parent)
    if validator_dir not in sys.path:
        sys.path.insert(0, validator_dir)

    try:
        import importlib
        import validator

        importlib.reload(validator)
        result = validator.run(data, schedule, baseline=baseline)

        # Standardise result shape
        hard_violations = result.get("hard_violations", [])
        hard_count = len(hard_violations) if isinstance(hard_violations, list) else int(result.get("hard_count", 0))

        return {
            "hard_violations": hard_violations,
            "hard_count": hard_count,
            "soft_penalty": result.get("soft_penalty", 0),
            "soft_breakdown": result.get("soft_breakdown", {}),
            "moved_sessions": result.get("moved_sessions", 0),
            "booking_score": result.get("booking_score", 0.0),
            "booking_breakdown": result.get("booking_breakdown", {}),
            "priority_inversions": result.get("priority_inversions", []),
            "raw_result": result,
        }
    except Exception as e:
        logger.error(f"Error running official validator: {e}", exc_info=True)
        return {
            "hard_violations": [f"Validator execution exception: {str(e)}"],
            "hard_count": 1,
            "soft_penalty": 999,
            "soft_breakdown": {},
            "moved_sessions": 0,
            "booking_score": 0.0,
            "booking_breakdown": {},
        }
