from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np


MODEL_PATH = Path(__file__).resolve().parent / "ensemble_model.pkl"
LEGACY_MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


@lru_cache(maxsize=1)
def _load_bundle(model_path: Path = MODEL_PATH) -> dict[str, Any]:
    if not model_path.exists():
        if model_path == MODEL_PATH and LEGACY_MODEL_PATH.exists():
            model_path = LEGACY_MODEL_PATH
        else:
            raise FileNotFoundError(
                f"Model not found at: {model_path}. Train it first by running ml_model/train_model.py"
            )
    bundle = joblib.load(model_path)
    if not isinstance(bundle, dict) or "model" not in bundle or "features" not in bundle:
        raise ValueError("Invalid model bundle")
    return bundle


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _fallback_nutriscore(nutrition_dict: dict[str, Any]) -> str:
    calories = _to_float(nutrition_dict.get("calories")) or 0.0
    sugar = _to_float(nutrition_dict.get("sugar")) or 0.0
    salt = _to_float(nutrition_dict.get("salt")) or 0.0
    fat = _to_float(nutrition_dict.get("fat")) or 0.0
    fiber = _to_float(nutrition_dict.get("fiber")) or 0.0
    protein = _to_float(nutrition_dict.get("protein")) or 0.0

    risk_score = 0.0
    risk_score += min(calories / 80.0, 6.0)
    risk_score += min(sugar / 4.5, 6.0)
    risk_score += min(salt / 0.6, 6.0)
    risk_score += min(fat / 3.0, 6.0)
    risk_score -= min(fiber / 1.5, 3.0)
    risk_score -= min(protein / 3.0, 2.0)

    if risk_score <= 2:
        return "A"
    if risk_score <= 5:
        return "B"
    if risk_score <= 8:
        return "C"
    if risk_score <= 11:
        return "D"
    return "E"


def predict_nutriscore(nutrition_dict: dict[str, Any], model_path: Path = MODEL_PATH) -> str:
    try:
        bundle = _load_bundle(model_path)
        model = bundle["model"]
        features: list[str] = list(bundle["features"])

        x = []
        for f in features:
            v = _to_float(nutrition_dict.get(f))
            x.append(0.0 if v is None else v)

        X = np.asarray([x], dtype=np.float32)
        pred = model.predict(X)[0]
        return str(pred).upper()
    except Exception:
        return _fallback_nutriscore(nutrition_dict)
