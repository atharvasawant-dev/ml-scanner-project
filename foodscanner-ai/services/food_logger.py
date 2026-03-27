from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from services import db_service


def log_food_consumption(
    db: Session,
    barcode: str,
    product_name: str,
    calories: Optional[float],
    user_id: int = 1,
) -> None:
    db_service.log_food_consumption(
        db,
        barcode=barcode,
        product_name=product_name,
        calories=calories,
        user_id=user_id,
    )
    db.commit()


def get_today_calories(db: Session, user_id: int) -> float:
    return db_service.get_today_calories(db, user_id=user_id)


def get_remaining_calories(user_profile: dict, db: Session, user_id: int) -> float:
    max_calories = user_profile.get("max_calories")
    if max_calories is None:
        return float("inf")

    return db_service.get_remaining_calories(db, daily_limit=float(max_calories), user_id=user_id)
