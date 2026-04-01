from __future__ import annotations

import json
import os
import time
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier, VotingClassifier
from sklearn.metrics import accuracy_score
from sklearn.model_selection import train_test_split

from .evaluation import comprehensive_evaluation
from .feature_engineering import create_feature_correlation_heatmap, engineer_features, select_best_features


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_DIR = Path(__file__).resolve().parent
PROGRESS_LOG_PATH = PROJECT_ROOT / "reports" / "training_progress.jsonl"

LARGE_CLEANED_CSV = PROJECT_ROOT / "datasets" / "large_openfoodfacts_cleaned.csv"
INDIAN_CSV_PATH = PROJECT_ROOT / "datasets" / "indian_foods" / "indian_packaged_foods.csv"


def _load_csv(path: Path) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Missing dataset: {path}")
    return pd.read_csv(path)


def _normalize_indian_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()

    rename_map = {}
    if "brand" in out.columns and "brands" not in out.columns:
        rename_map["brand"] = "brands"
    out = out.rename(columns=rename_map)

    for col in ["ingredients_text", "additives_tags", "nova_group", "nutriscore_grade", "code", "product_name", "brands"]:
        if col not in out.columns:
            out[col] = ""

    numeric_cols = ["calories", "fat", "saturated_fat", "sugar", "salt", "protein", "fiber", "carbs"]
    for c in numeric_cols:
        if c not in out.columns:
            out[c] = 0.0
        out[c] = pd.to_numeric(out[c], errors="coerce").fillna(0.0)

    out["nutriscore_grade"] = out["nutriscore_grade"].astype("string").str.strip().str.lower().replace({"": pd.NA})

    return out


def _label_from_nutriscore(df: pd.DataFrame) -> pd.Series:
    y = df["nutriscore_grade"].astype("string").str.strip().str.lower()
    y = y.fillna(pd.NA)
    y = y.where(y.isin(list("abcde")), pd.NA)
    return y


def _build_feature_matrix(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    df2 = engineer_features(df)
    y = _label_from_nutriscore(df2)
    df2 = df2.dropna(subset=["nutriscore_grade"])
    y = _label_from_nutriscore(df2)

    drop_cols = {"code", "product_name", "brands", "nutriscore_grade", "ingredients_text", "additives_tags"}
    X = df2[[c for c in df2.columns if c not in drop_cols]].copy()

    for c in X.columns:
        if X[c].dtype.kind not in {"i", "u", "f"}:
            X[c] = pd.to_numeric(X[c], errors="coerce")
    X = X.fillna(0.0)

    return X, y


def train_advanced_models() -> None:
    _log_progress({"event": "start", "ts": time.time()})
    df_large = _load_csv(LARGE_CLEANED_CSV)
    df_ind = _normalize_indian_columns(_load_csv(INDIAN_CSV_PATH)) if INDIAN_CSV_PATH.exists() else pd.DataFrame()

    df_all = pd.concat([df_large, df_ind], ignore_index=True) if not df_ind.empty else df_large

    fast_mode = str(os.environ.get("FAST_TRAINING") or "1").strip().lower() in {"1", "true", "yes"}
    if not fast_mode:
        create_feature_correlation_heatmap(df_all)

    X, y = _build_feature_matrix(df_all)

    y_str = y.astype("string").str.strip().str.lower()
    mask = y_str.isin(list("abcde"))
    X = X.loc[mask].copy()
    y_str = y_str.loc[mask]
    y_arr = y_str.astype(object).astype(str).to_numpy()

    best_features = select_best_features(X, pd.Series(y_arr, index=X.index), n_features=40)
    X = X[best_features]

    X_train, X_test, y_train, y_test = train_test_split(
        X.to_numpy(dtype=float),
        y_arr,
        test_size=0.2,
        random_state=42,
        stratify=y_arr,
    )

    rf = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
        max_features="sqrt",
        random_state=42,
        n_jobs=4,
        class_weight="balanced",
    )

    gb = GradientBoostingClassifier(
        n_estimators=200,
        learning_rate=0.1,
        max_depth=5,
        subsample=0.8,
        random_state=42,
    )

    # Demo-fast mode: skip XGBoost and SVM (too slow on CPU for most laptops)
    xgb = None
    svm = None

    _log_progress({"event": "search_skipped", "ts": time.time(), "reason": "fast_mode"})
    best_rf = rf

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    (MODEL_DIR / "best_hyperparams.json").write_text(json.dumps({"fast_mode": True}, indent=2), encoding="utf-8")

    best_rf.fit(X_train, y_train)
    gb.fit(X_train, y_train)

    ensemble = VotingClassifier(
        estimators=[("rf", best_rf), ("gb", gb)],
        voting="soft",
        weights=[1.0, 1.0],
        n_jobs=4,
    )
    ensemble.fit(X_train, y_train)

    for name, est in [
        ("random_forest_model.pkl", best_rf),
        ("gradient_boosting_model.pkl", gb),
        ("ensemble_model.pkl", ensemble),
    ]:
        joblib.dump({"model": est, "features": best_features, "classes": sorted(list(set(y_arr)))}, MODEL_DIR / name)

    eval_results = []
    for model_name, est in [
        ("random_forest", best_rf),
        ("gradient_boosting", gb),
        ("ensemble", ensemble),
    ]:
        y_pred = est.predict(X_test)
        y_proba = est.predict_proba(X_test) if hasattr(est, "predict_proba") else None
        res = comprehensive_evaluation(
            y_test=y_test,
            y_pred=y_pred,
            y_pred_proba=y_proba,
            model_name=model_name,
            X_test=X_test,
            estimator=est,
            feature_names=best_features,
        )
        eval_results.append(res)
        _log_progress(
            {
                "event": "model_evaluated",
                "ts": time.time(),
                "model": model_name,
                "accuracy": res.get("accuracy"),
                "balanced_accuracy": res.get("balanced_accuracy"),
                "f1_weighted": res.get("f1_weighted"),
                "f1_macro": res.get("f1_macro"),
                "roc_auc_macro_ovr": res.get("roc_auc_macro_ovr"),
            }
        )

    comp_rows = []
    for r in eval_results:
        comp_rows.append(
            {
                "model": r.get("model_name"),
                "accuracy": r.get("accuracy"),
                "balanced_accuracy": r.get("balanced_accuracy"),
                "f1_weighted": r.get("f1_weighted"),
                "f1_macro": r.get("f1_macro"),
                "roc_auc_macro_ovr": r.get("roc_auc_macro_ovr"),
            }
        )
    pd.DataFrame(comp_rows).to_csv(PROJECT_ROOT / "reports" / "model_comparison.csv", index=False)

    acc = accuracy_score(y_test, ensemble.predict(X_test))
    print(f"Ensemble accuracy: {acc:.4f}")
    _log_progress({"event": "done", "ts": time.time(), "ensemble_accuracy": float(acc)})


def _make_xgb():
    try:
        from xgboost import XGBClassifier

        return XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.9,
            tree_method="hist",
            random_state=42,
            n_jobs=-1,
            objective="multi:softprob",
            eval_metric="mlogloss",
        )
    except Exception:
        from sklearn.ensemble import GradientBoostingClassifier

        return GradientBoostingClassifier(
            n_estimators=250,
            learning_rate=0.05,
            max_depth=5,
            subsample=0.8,
            random_state=42,
        )


def _log_progress(payload: dict) -> None:
    try:
        PROGRESS_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
        with PROGRESS_LOG_PATH.open("a", encoding="utf-8") as f:
            f.write(json.dumps(payload) + "\n")
    except Exception:
        return


class _GridSearchProgressCallback:
    def __init__(self) -> None:
        self.best_score: float = float("-inf")
        self.step: int = 0

    def __call__(self, score: float, params: dict) -> None:
        self.step += 1
        if score > self.best_score:
            self.best_score = float(score)
        _log_progress(
            {
                "event": "gridsearch_step",
                "ts": time.time(),
                "step": self.step,
                "score": float(score),
                "best_so_far": float(self.best_score),
                "params": dict(params),
            }
        )
