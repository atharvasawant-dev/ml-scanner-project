from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Optional

import numpy as np


REPORTS_DIR = Path(__file__).resolve().parents[1] / "reports"


def comprehensive_evaluation(
    y_test: np.ndarray,
    y_pred: np.ndarray,
    y_pred_proba: Optional[np.ndarray],
    model_name: str,
    *,
    X_test: Optional[np.ndarray] = None,
    estimator: Any = None,
    feature_names: Optional[list[str]] = None,
) -> dict[str, Any]:
    from sklearn.metrics import (
        accuracy_score,
        balanced_accuracy_score,
        classification_report,
        confusion_matrix,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
        roc_curve,
    )
    from sklearn.model_selection import StratifiedKFold, cross_val_score
    from sklearn.preprocessing import label_binarize

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    y_test_arr = np.asarray(y_test)
    y_pred_arr = np.asarray(y_pred)

    labels = np.array(sorted(set(list(y_test_arr) + list(y_pred_arr))), dtype=y_test_arr.dtype)

    results: dict[str, Any] = {}
    results["model_name"] = model_name
    results["accuracy"] = float(accuracy_score(y_test_arr, y_pred_arr))
    results["balanced_accuracy"] = float(balanced_accuracy_score(y_test_arr, y_pred_arr))

    results["precision_weighted"] = float(precision_score(y_test_arr, y_pred_arr, average="weighted", zero_division=0))
    results["recall_weighted"] = float(recall_score(y_test_arr, y_pred_arr, average="weighted", zero_division=0))
    results["f1_weighted"] = float(f1_score(y_test_arr, y_pred_arr, average="weighted", zero_division=0))

    results["precision_macro"] = float(precision_score(y_test_arr, y_pred_arr, average="macro", zero_division=0))
    results["recall_macro"] = float(recall_score(y_test_arr, y_pred_arr, average="macro", zero_division=0))
    results["f1_macro"] = float(f1_score(y_test_arr, y_pred_arr, average="macro", zero_division=0))

    results["precision_micro"] = float(precision_score(y_test_arr, y_pred_arr, average="micro", zero_division=0))
    results["recall_micro"] = float(recall_score(y_test_arr, y_pred_arr, average="micro", zero_division=0))
    results["f1_micro"] = float(f1_score(y_test_arr, y_pred_arr, average="micro", zero_division=0))

    report = classification_report(y_test_arr, y_pred_arr, zero_division=0, output_dict=True)
    results["per_class"] = {k: v for k, v in report.items() if k not in {"accuracy", "macro avg", "weighted avg"}}

    cm = confusion_matrix(y_test_arr, y_pred_arr, labels=labels)
    results["confusion_matrix"] = cm.tolist()
    results["labels"] = [str(x) for x in labels]

    _save_confusion_matrix_plot(cm, labels, REPORTS_DIR / f"confusion_matrix_{model_name}.png")

    if y_pred_proba is not None:
        try:
            y_bin = label_binarize(y_test_arr, classes=labels)
            auc = roc_auc_score(y_bin, y_pred_proba, average="macro", multi_class="ovr")
            results["roc_auc_macro_ovr"] = float(auc)
            _save_roc_curves(y_bin, y_pred_proba, labels, REPORTS_DIR / f"roc_curves_{model_name}.png")
        except Exception:
            results["roc_auc_macro_ovr"] = None

    if estimator is not None and X_test is not None:
        try:
            cv = StratifiedKFold(n_splits=5, shuffle=True, random_state=42)
            cv_scores = cross_val_score(estimator, X_test, y_test_arr, cv=cv, scoring="accuracy")
            results["cv_accuracy_mean"] = float(np.mean(cv_scores))
            results["cv_accuracy_std"] = float(np.std(cv_scores))
        except Exception:
            results["cv_accuracy_mean"] = None
            results["cv_accuracy_std"] = None

    if estimator is not None and feature_names is not None:
        _maybe_save_feature_importance(estimator, feature_names, REPORTS_DIR / "feature_importance.png")

    _append_summary(results, model_name)
    _upsert_results_json(results, REPORTS_DIR / "evaluation_results.json")

    return results


def _append_summary(results: dict[str, Any], model_name: str) -> None:
    summary_path = REPORTS_DIR / "evaluation_summary.txt"
    lines = []
    lines.append(f"MODEL: {model_name}\n")
    for k in [
        "accuracy",
        "balanced_accuracy",
        "precision_weighted",
        "recall_weighted",
        "f1_weighted",
        "precision_macro",
        "recall_macro",
        "f1_macro",
        "roc_auc_macro_ovr",
        "cv_accuracy_mean",
        "cv_accuracy_std",
    ]:
        if k in results:
            lines.append(f"{k}: {results[k]}\n")
    lines.append("\n")

    summary_path.parent.mkdir(parents=True, exist_ok=True)
    with summary_path.open("a", encoding="utf-8") as f:
        f.writelines(lines)


def _save_json(obj: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2)


def _upsert_results_json(obj: dict[str, Any], path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            existing = {}
    else:
        existing = {}

    if isinstance(existing, dict) and "runs" in existing and isinstance(existing["runs"], list):
        existing["runs"].append(obj)
        _save_json(existing, path)
        return

    if isinstance(existing, list):
        existing.append(obj)
        with path.open("w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
        return

    _save_json({"runs": [obj]}, path)


def _save_confusion_matrix_plot(cm: np.ndarray, labels: np.ndarray, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    import seaborn as sns

    path.parent.mkdir(parents=True, exist_ok=True)

    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt="d", cmap="Blues", xticklabels=labels, yticklabels=labels)
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.tight_layout()
    plt.savefig(path, dpi=200)
    plt.close()


def _save_roc_curves(y_bin: np.ndarray, y_proba: np.ndarray, labels: np.ndarray, path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    from sklearn.metrics import auc, roc_curve

    plt.figure(figsize=(9, 6))

    for i, lbl in enumerate(labels):
        fpr, tpr, _ = roc_curve(y_bin[:, i], y_proba[:, i])
        roc_auc = auc(fpr, tpr)
        plt.plot(fpr, tpr, label=f"{lbl} (AUC={roc_auc:.2f})")

    plt.plot([0, 1], [0, 1], "k--", linewidth=1)
    plt.xlabel("False Positive Rate")
    plt.ylabel("True Positive Rate")
    plt.title("ROC Curves (One-vs-Rest)")
    plt.legend(loc="lower right")
    plt.tight_layout()
    plt.savefig(path, dpi=200)
    plt.close()


def _maybe_save_feature_importance(estimator: Any, feature_names: list[str], path: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    path.parent.mkdir(parents=True, exist_ok=True)

    importances = None
    if hasattr(estimator, "feature_importances_"):
        importances = getattr(estimator, "feature_importances_")
    elif hasattr(estimator, "named_estimators_"):
        for _, est in getattr(estimator, "named_estimators_").items():
            if hasattr(est, "feature_importances_"):
                importances = getattr(est, "feature_importances_")
                break

    if importances is None:
        return

    importances = np.asarray(importances)
    idx = np.argsort(importances)[::-1][:20]
    names = [feature_names[i] for i in idx]
    vals = importances[idx]

    plt.figure(figsize=(10, 6))
    plt.barh(list(reversed(names)), list(reversed(vals)))
    plt.title("Top 20 Feature Importances")
    plt.tight_layout()
    plt.savefig(path, dpi=200)
    plt.close()
