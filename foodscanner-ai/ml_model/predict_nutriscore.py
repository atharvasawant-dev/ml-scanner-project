from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any, Optional

import joblib
import numpy as np


MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"


@lru_cache(maxsize=1)
def _load_bundle(model_path: Path = MODEL_PATH) -> dict[str, Any]:
    if not model_path.exists():
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


def predict_nutriscore(nutrition_dict: dict[str, Any], model_path: Path = MODEL_PATH) -> str:
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
