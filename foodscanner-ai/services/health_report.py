from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy.orm import Session

from services import db_service
from services.food_health_score import compute_food_health_score


WHO_LIMITS = {
    "calories": 2000,
    "sugar": 50,
    "salt": 5,
    "fat": 70,
    "protein": 50,
    "fiber": 25,
}


def _sum_nutrient(logs: list[dict], nutrient: str) -> float:
    return sum(float(log.get(nutrient) or 0) for log in logs)


def _nutrient_status(consumed: float, limit: float) -> str:
    pct = consumed / limit if limit else 0
    if pct <= 0.8:
        return "OK"
    if pct <= 1.0:
        return "WARNING"
    return "DANGER"


def _calculate_day_score(
    nutrients: dict[str, dict[str, Any]],
    product_counts: dict[str, int],
) -> int:
    score = 100
    for n, data in nutrients.items():
        if data["percentage_used"] > 1.0:
            score -= 15
    score -= product_counts.get("AVOID", 0) * 10
    score -= product_counts.get("MODERATE", 0) * 5
    score += product_counts.get("SAFE", 0) * 5
    return max(0, min(100, score))


def _day_rating(score: int) -> str:
    if score >= 80:
        return "GREAT"
    if score >= 60:
        return "GOOD"
    if score >= 40:
        return "FAIR"
    return "POOR"


def _build_suggestions(
    nutrients: dict[str, dict[str, Any]],
    product_counts: dict[str, int],
) -> list[str]:
    suggestions: list[str] = []
    for n, data in nutrients.items():
        if data["percentage_used"] > 80:
            suggestions.append(
                f"You have consumed {data['percentage_used']:.0f}% of your daily {n} limit — avoid {n}-heavy products for the rest of the day"
            )
        elif data["percentage_used"] >= 50 and n == "protein":
            suggestions.append(f"Good job! Your {n} intake is on track")
    if product_counts.get("AVOID", 0) > 0:
        suggestions.append(
            f"You scanned {product_counts['AVOID']} AVOID product(s) today — try healthier alternatives"
        )
    if product_counts.get("SAFE", 0) >= 3:
        suggestions.append("Great job choosing SAFE products today!")
    if not suggestions:
        suggestions.append("Keep up the balanced eating!")
    return suggestions


def generate_daily_report(db: Session, user: Any) -> dict[str, Any]:
    logs = db_service.get_today_food_logs(db, int(user.id))
    if not logs:
        return {
            "date": date.today().isoformat(),
            "overall_score": 100,
            "overall_rating": "GREAT",
            "nutrition_breakdown": {},
            "products_scanned": {"SAFE": 0, "MODERATE": 0, "AVOID": 0},
            "suggestions": ["No food logged today. Start scanning to track your health!"],
            "total_products_today": 0,
        }

    # Total nutrition
    total = {
        "calories": _sum_nutrient(logs, "calories"),
        "sugar": _sum_nutrient(logs, "sugar"),
        "salt": _sum_nutrient(logs, "salt"),
        "fat": _sum_nutrient(logs, "fat"),
        "protein": _sum_nutrient(logs, "protein"),
        "fiber": _sum_nutrient(logs, "fiber"),
    }

    # Limits
    limits = {
        "calories": float(user.daily_calorie_limit or WHO_LIMITS["calories"]),
        "sugar": WHO_LIMITS["sugar"],
        "salt": WHO_LIMITS["salt"],
        "fat": WHO_LIMITS["fat"],
        "protein": WHO_LIMITS["protein"],
        "fiber": WHO_LIMITS["fiber"],
    }

    # Nutrition breakdown
    nutrition_breakdown: dict[str, dict[str, Any]] = {}
    for n, consumed in total.items():
        limit = limits[n]
        pct = consumed / limit if limit else 0
        nutrition_breakdown[n] = {
            "consumed": round(consumed, 1),
            "limit": limit,
            "percentage_used": round(pct * 100, 1),
            "status": _nutrient_status(consumed, limit),
        }

    # Product decision counts
    product_counts = {"SAFE": 0, "MODERATE": 0, "AVOID": 0}
    for log in logs:
        # Compute decision using existing scoring logic
        mock_product = {
            "calories": log["calories"],
            "sugar": log["sugar"],
            "salt": log["salt"],
            "fat": log["fat"],
            "saturated_fat": log.get("saturated_fat"),
            "protein": log["protein"],
            "fiber": log["fiber"],
            "ingredients": log["ingredients"],
            "additives": log["additives"],
        }
        result = compute_food_health_score(mock_product)
        decision = result.get("decision", "SAFE")
        if decision in product_counts:
            product_counts[decision] += 1

    # Day score and rating
    day_score = _calculate_day_score(nutrition_breakdown, product_counts)
    day_rating = _day_rating(day_score)

    # Suggestions
    suggestions = _build_suggestions(nutrition_breakdown, product_counts)

    return {
        "date": date.today().isoformat(),
        "overall_score": day_score,
        "overall_rating": day_rating,
        "nutrition_breakdown": nutrition_breakdown,
        "products_scanned": product_counts,
        "suggestions": suggestions,
        "total_products_today": len(logs),
    }
