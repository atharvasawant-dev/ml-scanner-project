from __future__ import annotations

import argparse
import time
from pathlib import Path
from typing import Any, Optional

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = PROJECT_ROOT / "reports"


def _try_import_matplotlib():
    import matplotlib

    matplotlib.use("TkAgg")
    import matplotlib.pyplot as plt

    return plt


def _load_training_data() -> pd.DataFrame:
    cleaned = PROJECT_ROOT / "datasets" / "large_openfoodfacts_cleaned.csv"
    if not cleaned.exists():
        raise FileNotFoundError(
            f"Missing cleaned dataset at {cleaned}. Run scripts/collect_large_dataset.py and scripts/clean_dataset.py first."
        )
    return pd.read_csv(cleaned)


def _simple_train_test_preview(df: pd.DataFrame) -> dict[str, Any]:
    from foodscanner_ai.ml_model.feature_engineering import engineer_features

    out = engineer_features(df)
    if "nutriscore_grade" not in out.columns:
        raise ValueError("nutriscore_grade column is required for training")

    y = out["nutriscore_grade"].astype("string").str.strip().str.lower()
    y = y.where(y.isin(list("abcde")), pd.NA)
    out = out.dropna(subset=["nutriscore_grade"]).copy()
    y = out["nutriscore_grade"].astype("string").str.strip().str.lower()

    drop_cols = {"code", "product_name", "brands", "nutriscore_grade", "ingredients_text", "additives_tags"}
    X = out[[c for c in out.columns if c not in drop_cols]].copy()

    for c in X.columns:
        if X[c].dtype.kind not in {"i", "u", "f"}:
            X[c] = pd.to_numeric(X[c], errors="coerce")
    X = X.fillna(0.0)

    from foodscanner_ai.ml_model.feature_engineering import select_best_features

    best_features = select_best_features(X, y, n_features=40)
    X = X[best_features]

    from sklearn.model_selection import train_test_split

    X_train, X_test, y_train, y_test = train_test_split(
        X.values,
        y.values,
        test_size=0.2,
        random_state=42,
        stratify=y.values,
    )

    return {
        "X_train": X_train,
        "X_test": X_test,
        "y_train": y_train,
        "y_test": y_test,
        "feature_names": best_features,
    }


def _live_plot_loop(
    *,
    title: str,
    xgb_metrics: dict[str, list[float]],
    other_progress: list[tuple[int, float]],
    refresh_seconds: float,
    save_png: bool,
    show_window: bool,
) -> None:
    plt = _try_import_matplotlib()

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REPORTS_DIR / "live_training_dashboard.png"

    if show_window:
        plt.ion()

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(11, 7))
    fig.suptitle(title)

    while True:
        ax1.clear()
        ax2.clear()

        if xgb_metrics:
            for k, vals in xgb_metrics.items():
                if vals:
                    ax1.plot(range(1, len(vals) + 1), vals, label=k)
            ax1.set_title("XGBoost live eval metrics (per boosting round)")
            ax1.set_xlabel("round")
            ax1.legend(loc="best")
        else:
            ax1.text(0.05, 0.5, "XGBoost metrics unavailable (xgboost not installed).", transform=ax1.transAxes)
            ax1.set_axis_off()

        if other_progress:
            xs = [p[0] for p in other_progress]
            ys = [p[1] for p in other_progress]
            ax2.plot(xs, ys)
            ax2.set_title("GridSearch best CV score so far")
            ax2.set_xlabel("grid step")
            ax2.set_ylabel("best_score")
        else:
            ax2.text(0.05, 0.5, "GridSearch progress will appear during advanced training.", transform=ax2.transAxes)
            ax2.set_axis_off()

        fig.tight_layout()

        if save_png:
            fig.savefig(out_path, dpi=160)

        if show_window:
            fig.canvas.draw()
            fig.canvas.flush_events()

        time.sleep(refresh_seconds)


def run_dashboard(*, refresh_seconds: float, save_png: bool, show_window: bool) -> None:
    df = _load_training_data()

    prep = _simple_train_test_preview(df)
    X_train = prep["X_train"]
    y_train = prep["y_train"]

    xgb_metrics: dict[str, list[float]] = {}

    try:
        from xgboost import XGBClassifier

        xgb = XGBClassifier(
            n_estimators=200,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.9,
            tree_method="hist",
            random_state=42,
            n_jobs=-1,
            objective="multi:softprob",
            eval_metric=["mlogloss", "merror"],
        )

        eval_set = [(X_train, y_train)]
        xgb.fit(X_train, y_train, eval_set=eval_set, verbose=False)

        results = xgb.evals_result()
        if results and "validation_0" in results:
            for metric_name, values in results["validation_0"].items():
                xgb_metrics[str(metric_name)] = [float(v) for v in values]
    except Exception:
        xgb_metrics = {}

    other_progress: list[tuple[int, float]] = []

    _live_plot_loop(
        title="FoodScanner AI: Live Training Dashboard",
        xgb_metrics=xgb_metrics,
        other_progress=other_progress,
        refresh_seconds=refresh_seconds,
        save_png=save_png,
        show_window=show_window,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Live visuals for FoodScanner AI training")
    parser.add_argument("--refresh", type=float, default=1.0, help="Refresh interval in seconds")
    parser.add_argument("--save-png", action="store_true", help="Continuously update reports/live_training_dashboard.png")
    parser.add_argument("--window", action="store_true", help="Show interactive matplotlib window")

    args = parser.parse_args()

    run_dashboard(refresh_seconds=args.refresh, save_png=args.save_png, show_window=args.window)


if __name__ == "__main__":
    main()
