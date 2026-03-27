from __future__ import annotations

from pathlib import Path
from typing import Any, Optional

import pandas as pd
from rapidfuzz import fuzz


INDIAN_DATASET_PATH = Path(__file__).resolve().parents[1] / "datasets" / "indian_foods" / "indian_packaged_foods.csv"


def _normalize_name(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _percent_change(base: Optional[float], alt: Optional[float]) -> Optional[int]:
    if base is None or alt is None:
        return None
    if base == 0:
        return None
    return int(round(((base - alt) / base) * 100))


def _percent_increase(base: Optional[float], alt: Optional[float]) -> Optional[int]:
    if base is None or alt is None:
        return None
    if base == 0:
        return None
    return int(round(((alt - base) / base) * 100))


def _build_reason(
    base_sugar: Optional[float],
    base_salt: Optional[float],
    base_fat: Optional[float],
    base_fiber: Optional[float],
    alt_sugar: Optional[float],
    alt_salt: Optional[float],
    alt_fat: Optional[float],
    alt_fiber: Optional[float],
) -> str:
    parts: list[str] = []

    sugar_pct = _percent_change(base_sugar, alt_sugar)
    if sugar_pct is not None and sugar_pct > 0:
        parts.append(f"{sugar_pct}% less sugar")

    salt_pct = _percent_change(base_salt, alt_salt)
    if salt_pct is not None and salt_pct > 0:
        parts.append(f"{salt_pct}% less sodium")

    fat_pct = _percent_change(base_fat, alt_fat)
    if fat_pct is not None and fat_pct > 0:
        parts.append(f"{fat_pct}% less fat")

    fiber_pct = _percent_increase(base_fiber, alt_fiber)
    if fiber_pct is not None and fiber_pct > 0:
        parts.append(f"{fiber_pct}% more fiber")

    if not parts:
        return "improved nutrition profile"

    if len(parts) == 1:
        return parts[0]
    if len(parts) == 2:
        return f"{parts[0]} and {parts[1]}"
    return ", ".join(parts[:-1]) + f" and {parts[-1]}"


def _similarity(query: str, name: str) -> float:
    q = (query or "").strip().lower()
    n = (name or "").strip().lower()
    if not q or not n:
        return 0.0

    return max(
        float(fuzz.token_set_ratio(q, n)),
        float(fuzz.partial_ratio(q, n)),
    )


def get_healthier_alternatives(
    product_name: str,
    nutrition_data: dict[str, Any],
    limit: int = 3,
    min_similarity: float = 70.0,
) -> list[dict[str, Any]]:
    name = _normalize_name(product_name)
    if not name:
        return []
    if not INDIAN_DATASET_PATH.exists():
        return []

    try:
        df = pd.read_csv(INDIAN_DATASET_PATH)
    except Exception:
        return []

    if "product_name" not in df.columns:
        return []

    base_sugar = _to_float(nutrition_data.get("sugar"))
    base_salt = _to_float(nutrition_data.get("salt"))
    base_fat = _to_float(nutrition_data.get("fat"))
    base_fiber = _to_float(nutrition_data.get("fiber"))

    scored: list[dict[str, Any]] = []
    for _, row in df.iterrows():
        alt_name = _normalize_name(row.get("product_name"))
        if not alt_name:
            continue
        if alt_name.strip().lower() == name.strip().lower():
            continue

        score = _similarity(name, alt_name)
        if score < min_similarity:
            continue

        alt_sugar = _to_float(row.get("sugar"))
        alt_salt = _to_float(row.get("salt"))
        alt_fat = _to_float(row.get("fat"))
        alt_fiber = _to_float(row.get("fiber"))

        def _lower_or_unknown(alt: Optional[float], base: Optional[float]) -> bool:
            if alt is None or base is None:
                return True
            return alt < base

        if not (
            _lower_or_unknown(alt_sugar, base_sugar)
            and _lower_or_unknown(alt_salt, base_salt)
            and _lower_or_unknown(alt_fat, base_fat)
        ):
            continue

        scored.append(
            {
                "product_name": alt_name,
                "brand": _normalize_name(row.get("brand")) or None,
                "nutrition": {
                    "calories": _to_float(row.get("calories")),
                    "sugar": alt_sugar,
                    "salt": alt_salt,
                    "fat": alt_fat,
                    "protein": _to_float(row.get("protein")),
                    "fiber": _to_float(row.get("fiber")),
                    "carbs": _to_float(row.get("carbs")),
                },
                "reason": _build_reason(
                    base_sugar=base_sugar,
                    base_salt=base_salt,
                    base_fat=base_fat,
                    base_fiber=base_fiber,
                    alt_sugar=alt_sugar,
                    alt_salt=alt_salt,
                    alt_fat=alt_fat,
                    alt_fiber=alt_fiber,
                ),
                "similarity": score,
                "source": "indian_dataset",
            }
        )

    scored.sort(
        key=lambda x: (
            float(x.get("similarity") or 0.0),
            -float((x.get("nutrition") or {}).get("sugar") or 0.0),
            -float((x.get("nutrition") or {}).get("salt") or 0.0),
            -float((x.get("nutrition") or {}).get("fat") or 0.0),
        ),
        reverse=True,
    )

    return scored[: int(limit)]
