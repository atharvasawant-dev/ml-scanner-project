from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from database.models import ScanHistory
from services import db_service
from services.food_health_score import compute_food_health_score


GOAL_RECOMMENDATIONS = {
    "lose_weight": [
        "Avoid products over 400 calories",
        "Prefer high fiber products",
    ],
    "control_sugar": [
        "Stay under 10g sugar per product",
        "Avoid additives E951, E952",
    ],
    "eat_clean": [
        "Avoid all HIGH risk additives",
        "Choose products with NutriScore A or B",
    ],
    "build_muscle": [
        "Prioritize products with protein > 10g",
        "Avoid high fat products",
    ],
    "reduce_sodium": [
        "Avoid products with salt > 0.5g",
        "Check for additive E621",
    ],
}


def _days_between(start: str, end: date) -> int:
    try:
        start_date = date.fromisoformat(start)
    except Exception:
        return 0
    return (end - start_date).days


def _average_score_since_goal(db: Session, user_id: int, start_date: str) -> float:
    # Use scan_history decisions to approximate average score
    rows = (
        db.execute(
            select(func.upper(ScanHistory.result))
            .where(
                ScanHistory.user_id == int(user_id),
                func.substr(ScanHistory.scan_time, 1, 10) >= start_date,
            )
        )
        .all()
    )
    if not rows:
        return 0.0
    total = 0.0
    for (res,) in rows:
        r = str(res or "").upper()
        if r == "SAFE":
            total += 80.0
        elif r == "MODERATE":
            total += 55.0
        elif r == "AVOID":
            total += 30.0
    return total / len(rows)


def generate_goal_report(db: Session, user: Any) -> dict[str, Any]:
    goal_type = user.goal_type
    if not goal_type:
        return {
            "goal_type": None,
            "days_active": 0,
            "days_remaining": 0,
            "progress_score": 0,
            "status": "NO_GOAL",
            "goal_summary": "No active goal. Set a goal in your profile to track progress.",
            "recommendations": [],
        }

    today = date.today()
    started = user.goal_started_at or today.isoformat()
    target_days = user.goal_target_days or 30
    days_active = _days_between(started, today)
    days_remaining = max(0, target_days - days_active)
    progress_score = _average_score_since_goal(db, int(user.id), started)

    if progress_score >= 60:
        status = "ON_TRACK"
    elif progress_score >= 40:
        status = "NEEDS_IMPROVEMENT"
    else:
        status = "OFF_TRACK"

    goal_summary = (
        f"You are {status.lower().replace('_', ' ')} with your {goal_type.replace('_', ' ')} goal! "
        f"Average daily score: {progress_score:.0f}/100"
    )

    recommendations = GOAL_RECOMMENDATIONS.get(goal_type, [])

    return {
        "goal_type": goal_type,
        "days_active": days_active,
        "days_remaining": days_remaining,
        "progress_score": round(progress_score, 1),
        "status": status,
        "goal_summary": goal_summary,
        "recommendations": recommendations,
    }
