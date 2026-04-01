from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REPORTS_DIR = PROJECT_ROOT / "reports"
PROGRESS_LOG = REPORTS_DIR / "training_progress.jsonl"
OUTPUT_PNG = REPORTS_DIR / "live_training_dashboard.png"


def _load_events(path: Path) -> list[dict[str, Any]]:
    if not path.exists():
        return []

    events: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                events.append(json.loads(line))
            except Exception:
                continue
    return events


def _build_state(events: list[dict[str, Any]]) -> dict[str, Any]:
    state: dict[str, Any] = {
        "grid_steps": [],
        "grid_best": [],
        "models": {},
        "started": False,
        "done": False,
        "ensemble_accuracy": None,
    }

    for e in events:
        et = e.get("event")
        if et == "start":
            state["started"] = True
        elif et == "gridsearch_step":
            step = int(e.get("step") or 0)
            best = float(e.get("best_so_far") or 0.0)
            state["grid_steps"].append(step)
            state["grid_best"].append(best)
        elif et == "model_evaluated":
            m = str(e.get("model") or "")
            if not m:
                continue
            state["models"][m] = {
                "accuracy": e.get("accuracy"),
                "balanced_accuracy": e.get("balanced_accuracy"),
                "f1_weighted": e.get("f1_weighted"),
                "f1_macro": e.get("f1_macro"),
                "roc_auc_macro_ovr": e.get("roc_auc_macro_ovr"),
            }
        elif et == "done":
            state["done"] = True
            state["ensemble_accuracy"] = e.get("ensemble_accuracy")

    return state


def _render_dashboard(state: dict[str, Any], out_png: Path) -> None:
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    out_png.parent.mkdir(parents=True, exist_ok=True)

    fig = plt.figure(figsize=(13, 8))
    gs = fig.add_gridspec(2, 2)

    ax_grid = fig.add_subplot(gs[0, 0])
    ax_models = fig.add_subplot(gs[0, 1])
    ax_text = fig.add_subplot(gs[1, :])

    fig.suptitle("FoodScanner AI - Live Training Dashboard", fontsize=16)

    steps = state.get("grid_steps") or []
    bests = state.get("grid_best") or []
    if steps and bests:
        ax_grid.plot(steps, bests, linewidth=2)
        ax_grid.set_title("RandomForest GridSearch: best CV accuracy so far")
        ax_grid.set_xlabel("grid step")
        ax_grid.set_ylabel("best CV accuracy")
        ax_grid.grid(True, alpha=0.25)
    else:
        ax_grid.text(0.1, 0.5, "Waiting for GridSearch progress...", transform=ax_grid.transAxes)
        ax_grid.set_axis_off()

    models = state.get("models") or {}
    if models:
        names = sorted(models.keys())
        accs = [float(models[n]["accuracy"] or 0.0) for n in names]
        ax_models.bar(names, accs)
        ax_models.set_ylim(0.0, 1.0)
        ax_models.set_title("Model test accuracy (updates as models finish)")
        ax_models.set_ylabel("accuracy")
        ax_models.tick_params(axis="x", rotation=20)
    else:
        ax_models.text(0.1, 0.5, "Waiting for model evaluations...", transform=ax_models.transAxes)
        ax_models.set_axis_off()

    ax_text.axis("off")

    lines = []
    lines.append(f"Progress log: {PROGRESS_LOG}")
    lines.append(f"Started: {state.get('started')}   Done: {state.get('done')}")
    if state.get("ensemble_accuracy") is not None:
        lines.append(f"Final Ensemble Accuracy: {state.get('ensemble_accuracy')}")

    if models:
        lines.append("\nLatest metrics:")
        for n in sorted(models.keys()):
            m = models[n]
            lines.append(
                f"- {n}: acc={m.get('accuracy')} bal_acc={m.get('balanced_accuracy')} f1w={m.get('f1_weighted')}"
            )

    ax_text.text(0.01, 0.98, "\n".join(lines), va="top", family="monospace", fontsize=11)

    fig.tight_layout(rect=[0, 0, 1, 0.95])
    fig.savefig(out_png, dpi=170)
    plt.close(fig)


def watch(refresh_seconds: float) -> None:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    last_mtime = None
    while True:
        if PROGRESS_LOG.exists():
            mtime = PROGRESS_LOG.stat().st_mtime
        else:
            mtime = None

        if mtime != last_mtime:
            events = _load_events(PROGRESS_LOG)
            state = _build_state(events)
            _render_dashboard(state, OUTPUT_PNG)
            last_mtime = mtime

        time.sleep(refresh_seconds)


def main() -> None:
    parser = argparse.ArgumentParser(description="Watch advanced training and render a live dashboard PNG")
    parser.add_argument("--refresh", type=float, default=1.0, help="Refresh interval (seconds)")
    args = parser.parse_args()

    watch(args.refresh)


if __name__ == "__main__":
    main()
