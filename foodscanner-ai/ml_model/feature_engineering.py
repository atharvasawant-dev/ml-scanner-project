from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd


REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"


_HARMFUL_INGREDIENT_KEYWORDS = {
    "palm oil": 6,
    "hydrogenated": 8,
    "partially hydrogenated": 10,
    "high fructose": 8,
    "high-fructose": 8,
    "glucose syrup": 7,
    "corn syrup": 7,
    "invert sugar": 6,
    "maltodextrin": 6,
    "artificial": 5,
    "aspartame": 8,
    "acesulfame": 8,
    "sucralose": 7,
    "monosodium glutamate": 6,
    "msg": 6,
    "emulsifier": 4,
    "color": 3,
    "colour": 3,
    "preservative": 4,
    "flavour": 3,
    "flavor": 3,
}

_ADDITIVE_RISK_WEIGHTS = {
    "en:e102": 6,
    "en:e110": 6,
    "en:e122": 6,
    "en:e124": 6,
    "en:e129": 6,
    "en:e211": 5,
    "en:e220": 5,
    "en:e250": 7,
    "en:e251": 7,
    "en:e621": 4,
    "en:e951": 7,
    "en:e950": 7,
    "en:e955": 7,
}


def _safe_div(n: float, d: float, default: float = 0.0) -> float:
    if d is None or d == 0 or np.isnan(d):
        return default
    if n is None or np.isnan(n):
        return default
    return float(n) / float(d)


def _clip(v: float, lo: float, hi: float) -> float:
    try:
        return float(np.clip(v, lo, hi))
    except Exception:
        return lo


def _score_ingredients(text: Any) -> float:
    s = str(text or "").lower()
    if not s.strip():
        return 0.0

    score = 0.0
    for kw, w in _HARMFUL_INGREDIENT_KEYWORDS.items():
        if kw in s:
            score += float(w)

    separators = [",", ";"]
    parts = [s]
    for sep in separators:
        parts = [p for chunk in parts for p in chunk.split(sep)]
    ingredient_count = sum(1 for p in parts if p.strip())

    score += min(ingredient_count / 5.0, 12.0)

    return _clip(score * 4.0, 0.0, 100.0)


def _score_additives(tags: Any) -> float:
    if tags is None:
        return 0.0
    if isinstance(tags, float) and np.isnan(tags):
        return 0.0

    if isinstance(tags, list):
        items = [str(x).strip().lower() for x in tags if x is not None]
    else:
        raw = str(tags)
        items = [t.strip().lower() for t in raw.replace(";", ",").split(",") if t.strip()]

    if not items:
        return 0.0

    score = 0.0
    for t in items:
        score += float(_ADDITIVE_RISK_WEIGHTS.get(t, 1.0))

    return _clip(score * 3.0, 0.0, 100.0)


def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    numeric_cols = [
        "calories",
        "fat",
        "saturated_fat",
        "sugar",
        "salt",
        "protein",
        "fiber",
        "carbs",
    ]
    for c in numeric_cols:
        if c in out.columns:
            out[c] = pd.to_numeric(out[c], errors="coerce")
        else:
            out[c] = 0.0

    out["saturated_fat"] = out["saturated_fat"].fillna(0.0)
    out["fiber"] = out["fiber"].fillna(0.0)

    out["calories"] = out["calories"].fillna(0.0)
    out["fat"] = out["fat"].fillna(0.0)
    out["sugar"] = out["sugar"].fillna(0.0)
    out["salt"] = out["salt"].fillna(0.0)
    out["protein"] = out["protein"].fillna(0.0)
    out["carbs"] = out["carbs"].fillna(0.0)

    calories = out["calories"].astype(float)
    fat = out["fat"].astype(float)
    satfat = out["saturated_fat"].astype(float)
    sugar = out["sugar"].astype(float)
    salt = out["salt"].astype(float)
    protein = out["protein"].astype(float)
    fiber = out["fiber"].astype(float)
    carbs = out["carbs"].astype(float)

    eps = 1e-6

    out["sugar_protein_ratio"] = sugar / (protein + eps)
    out["fiber_carbs_ratio"] = fiber / (carbs + eps)
    out["fat_calories_ratio"] = fat / (calories + eps)
    out["energy_density"] = calories / (carbs + protein + fat + eps)
    out["satfat_to_fat_ratio"] = satfat / (fat + eps)
    out["carbs_to_fiber_ratio"] = carbs / (fiber + eps)

    out["protein_density"] = protein / (calories + eps) * 100.0
    out["fiber_adequacy"] = fiber / 5.0
    out["nutrient_density"] = (protein + fiber) / (calories + eps) * 100.0
    out["unhealthy_density"] = (sugar + salt * 10.0 + satfat) / (calories + eps) * 100.0

    out["carb_balance_score"] = 1.0 - np.abs((carbs / (carbs + protein + fat + eps)) - 0.55)
    out["protein_adequacy_score"] = np.minimum(protein / 10.0, 2.0)
    out["sugar_excess_score"] = np.maximum((sugar - 10.0) / 30.0, 0.0)
    out["fiber_deficit_score"] = np.maximum((5.0 - fiber) / 5.0, 0.0)

    if "nova_group" in out.columns:
        nova = pd.to_numeric(out["nova_group"], errors="coerce").fillna(0)
    else:
        nova = pd.Series(0, index=out.index)

    out["is_highly_processed"] = (nova >= 4).astype(int)

    ing_text = out.get("ingredients_text")
    if ing_text is None:
        ing_text = pd.Series([""] * len(out), index=out.index)
    ing_text = ing_text.astype("string").fillna("")

    out["ingredient_count"] = (
        ing_text.str.replace(";", ",", regex=False)
        .str.split(",")
        .apply(lambda xs: sum(1 for x in xs if str(x).strip()))
        .astype(float)
    )

    add_tags = out.get("additives_tags")
    if add_tags is None:
        add_tags = pd.Series([""] * len(out), index=out.index)
    add_tags = add_tags.astype("string").fillna("")

    out["additive_count"] = (
        add_tags.str.replace(";", ",", regex=False)
        .str.split(",")
        .apply(lambda xs: sum(1 for x in xs if str(x).strip()))
        .astype(float)
    )

    out["ingredient_risk_score"] = ing_text.apply(_score_ingredients).astype(float)
    out["additive_risk_score"] = add_tags.apply(_score_additives).astype(float)

    out["calories_squared"] = calories**2
    out["sugar_cubed"] = sugar**3
    out["salt_squared"] = salt**2

    out["sugar_fat_interaction"] = sugar * fat
    out["salt_calories_interaction"] = salt * calories
    out["fiber_carbs_interaction"] = fiber * carbs
    out["protein_satfat_interaction"] = protein * satfat
    out["processed_sugar_interaction"] = out["is_highly_processed"].astype(float) * sugar

    out["log_calories"] = np.log1p(calories)
    out["log_sugar"] = np.log1p(sugar)
    out["log_salt"] = np.log1p(salt)
    out["log_fat"] = np.log1p(fat)
    out["log_protein"] = np.log1p(protein)
    out["log_fiber"] = np.log1p(fiber)
    out["log_carbs"] = np.log1p(carbs)

    out["fat_sugar_sum"] = fat + sugar
    out["protein_fiber_sum"] = protein + fiber
    out["salt_sugar_sum"] = salt + sugar
    out["satfat_sugar_sum"] = satfat + sugar

    out["pct_sugar_of_macros"] = sugar / (carbs + eps)
    out["pct_fat_of_macros"] = fat / (fat + carbs + protein + eps)
    out["pct_protein_of_macros"] = protein / (fat + carbs + protein + eps)

    out["salt_per_100_cal"] = salt / (calories + eps) * 100.0
    out["sugar_per_100_cal"] = sugar / (calories + eps) * 100.0
    out["fiber_per_100_cal"] = fiber / (calories + eps) * 100.0
    out["protein_per_100_cal"] = protein / (calories + eps) * 100.0

    out["sweet_salty_index"] = (sugar * 0.7) + (salt * 30.0)
    out["satfat_salt_index"] = (satfat * 1.2) + (salt * 25.0)

    out["macro_total"] = fat + carbs + protein
    out["macro_imbalance"] = np.std(np.vstack([fat, carbs, protein]).T, axis=1)

    out["quality_score"] = (
        100.0
        - _clip(out["ingredient_risk_score"], 0.0, 100.0)
        - _clip(out["additive_risk_score"], 0.0, 100.0) * 0.5
        - _clip(out["sugar_excess_score"] * 50.0, 0.0, 50.0)
        - _clip(salt * 8.0, 0.0, 40.0)
        + _clip(fiber * 4.0, 0.0, 30.0)
        + _clip(protein * 2.0, 0.0, 20.0)
    )

    out["risk_index"] = (
        (calories / 10.0)
        + (sugar * 1.5)
        + (salt * 30.0)
        + (satfat * 1.2)
        - (fiber * 2.0)
        - (protein * 1.0)
        + out["is_highly_processed"].astype(float) * 5.0
        + out["additive_count"] * 0.5
    )

    out["risk_bucket"] = pd.cut(out["risk_index"], bins=[-np.inf, 10, 20, 30, 40, np.inf], labels=[0, 1, 2, 3, 4]).astype(int)

    out = out.replace([np.inf, -np.inf], 0.0)

    return out


def select_best_features(X: pd.DataFrame, y: pd.Series, n_features: int = 40) -> list[str]:
    from sklearn.ensemble import RandomForestClassifier

    X_num = X.copy()
    for c in X_num.columns:
        X_num[c] = pd.to_numeric(X_num[c], errors="coerce").fillna(0.0)

    X_num = X_num.replace([np.inf, -np.inf], 0.0).fillna(0.0)

    y_clean = y.astype("string").fillna(pd.NA)
    y_clean = y_clean.astype(object)
    y_arr = np.asarray([str(v) for v in y_clean.tolist()], dtype=object)

    rf = RandomForestClassifier(n_estimators=250, random_state=42, n_jobs=-1, class_weight="balanced")
    rf.fit(X_num.to_numpy(dtype=float), y_arr)

    importances = rf.feature_importances_
    idx = np.argsort(importances)[::-1][:n_features]
    return [str(X_num.columns[i]) for i in idx]


def _save_correlation_heatmap(df_features: pd.DataFrame, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    import seaborn as sns

    path.parent.mkdir(parents=True, exist_ok=True)

    corr = df_features.corr(numeric_only=True).fillna(0.0)

    plt.figure(figsize=(18, 14))
    sns.heatmap(corr, cmap="coolwarm", center=0.0, linewidths=0.0)
    plt.tight_layout()
    plt.savefig(path, dpi=200)
    plt.close()


def create_feature_correlation_heatmap(df: pd.DataFrame) -> Path:
    engineered = engineer_features(df)

    keep_cols = [
        c
        for c in engineered.columns
        if c
        not in {
            "code",
            "product_name",
            "brands",
            "nutriscore_grade",
            "ingredients_text",
            "additives_tags",
        }
    ]

    numeric_df = engineered[keep_cols].select_dtypes(include=["number"]).copy()
    if numeric_df.shape[1] > 80:
        numeric_df = numeric_df.iloc[:, :80]

    out_path = REPORTS_DIR / "feature_correlation.png"
    _save_correlation_heatmap(numeric_df, out_path)
    return out_path
