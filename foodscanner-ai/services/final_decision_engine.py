from __future__ import annotations

from typing import Any, Optional


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def compute_final_decision(
    health_score_result: dict,
    remaining_calories: float,
    product_calories: float,
) -> dict:
    health_score = _to_float(health_score_result.get("health_score"))
    base_decision = str(health_score_result.get("decision") or "").upper()

    remaining = _to_float(remaining_calories)
    calories = _to_float(product_calories)

    final_decision = base_decision

    over_budget = False
    if remaining is not None and calories is not None:
        over_budget = calories > remaining

    if base_decision == "SAFE" and over_budget:
        final_decision = "MODERATE"
    elif base_decision == "MODERATE" and over_budget:
        final_decision = "AVOID"
    elif base_decision == "AVOID":
        final_decision = "AVOID"

    if over_budget:
        reason = f"Health score suggests {base_decision}, but exceeds remaining calorie budget"
    else:
        reason = f"Health score suggests {base_decision}"

    return {
        "final_decision": final_decision,
        "health_score": health_score,
        "reason": reason,
    }
