from __future__ import annotations

import argparse
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split


MODEL_PATH = Path(__file__).resolve().parent / "model.pkl"
INDIAN_CSV_PATH = Path(__file__).resolve().parent.parent / "datasets" / "indian_foods" / "indian_packaged_foods.csv"


FEATURES = ["calories", "fat", "sugar", "salt", "protein", "fiber", "carbs"]
CLASSES = np.array(list("abcde"))


def _nutriscore_points_per_100g(product: pd.Series) -> int:
    """Official NutriScore points per 100g (simplified version)."""
    points = 0

    # Energy (kJ)
    energy_kj = product.get("calories", 0) * 4.184
    if energy_kj > 3350:
        points += 10
    elif energy_kj > 3010:
        points += 8
    elif energy_kj > 2670:
        points += 6
    elif energy_kj > 2330:
        points += 4
    elif energy_kj > 1990:
        points += 2

    # Sugars
    sugar = product.get("sugar", 0)
    if sugar > 13.5:
        points += 10
    elif sugar > 9:
        points += 8
    elif sugar > 4.5:
        points += 6
    elif sugar > 0:
        points += 4

    # Saturated fat
    sat_fat = product.get("saturated_fat", 0)
    if sat_fat > 10:
        points += 10
    elif sat_fat > 6:
        points += 8
    elif sat_fat > 3:
        points += 6
    elif sat_fat > 0:
        points += 4

    # Sodium (mg)
    sodium_mg = product.get("salt", 0) * 1000 * 2.5  # rough conversion: 1g salt ≈ 400mg Na
    if sodium_mg > 900:
        points += 10
    elif sodium_mg > 600:
        points += 8
    elif sodium_mg > 300:
        points += 6
    elif sodium_mg > 0:
        points += 4

    # Protein (negative points)
    protein = product.get("protein", 0)
    if protein > 8:
        points -= 5
    elif protein > 6.5:
        points -= 2
    elif protein > 4.7:
        points -= 1

    # Fiber (negative points)
    fiber = product.get("fiber", 0)
    if fiber > 4.7:
        points -= 5
    elif fiber > 3.7:
        points -= 2
    elif fiber > 2.8:
        points -= 1

    # Fruits/veg/legumes/nuts (assume 0 for packaged foods)
    # points -= 5 if high content else 0

    return max(0, points)


def _nutriscore_label_from_points(points: int) -> str:
    if points <= -1:
        return "a"
    if points <= 2:
        return "b"
    if points <= 10:
        return "c"
    if points <= 18:
        return "d"
    return "e"


def _load_real_indian_data(csv_path: Path) -> tuple[np.ndarray, np.ndarray]:
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=FEATURES, how="all")
    df = df.fillna(0)

    X = df[FEATURES].values.astype(np.float32)
    y = np.array([_nutriscore_label_from_points(_nutriscore_points_per_100g(row)) for _, row in df.iterrows()], dtype="<U1")
    return X, y


def _generate_synthetic_data(n_samples: int = 2000, seed: int = 42) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)

    calories = rng.uniform(0, 700, n_samples)
    fat = rng.uniform(0, 60, n_samples)
    sugar = rng.uniform(0, 60, n_samples)
    salt = rng.uniform(0, 5, n_samples)
    protein = rng.uniform(0, 40, n_samples)
    fiber = rng.uniform(0, 30, n_samples)
    carbs = rng.uniform(0, 100, n_samples)

    X = np.column_stack([calories, fat, sugar, salt, protein, fiber, carbs]).astype(np.float32)

    risk = (
        0.004 * calories
        + 0.12 * fat
        + 0.18 * sugar
        + 2.5 * salt
        + 0.02 * carbs
        - 0.08 * protein
        - 0.25 * fiber
    )
    risk += rng.normal(0, 1.5, n_samples)

    y = np.empty(n_samples, dtype="<U1")
    y[risk < 3.0] = "a"
    y[(risk >= 3.0) & (risk < 6.0)] = "b"
    y[(risk >= 6.0) & (risk < 9.0)] = "c"
    y[(risk >= 9.0) & (risk < 12.0)] = "d"
    y[risk >= 12.0] = "e"

    return X, y


def train_model(model_path: Path = MODEL_PATH) -> None:
    # Load real Indian data if available
    if INDIAN_CSV_PATH.is_file():
        print("Loading real Indian food CSV...")
        X_real, y_real = _load_real_indian_data(INDIAN_CSV_PATH)
        print(f"Loaded {X_real.shape[0]} real samples.")
    else:
        print("Indian CSV not found; skipping real data.")
        X_real, y_real = np.empty((0, len(FEATURES)), dtype=np.float32), np.empty(0, dtype="<U1")

    # Supplement with synthetic data
    X_syn, y_syn = _generate_synthetic_data(n_samples=2000)
    print(f"Generated {X_syn.shape[0]} synthetic samples.")

    X = np.vstack([X_real, X_syn])
    y = np.concatenate([y_real, y_syn])

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    clf = RandomForestClassifier(
        n_estimators=300,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced_subsample",
    )
    clf.fit(X_train, y_train)

    preds = clf.predict(X_test)
    acc = accuracy_score(y_test, preds)
    report = classification_report(y_test, preds, target_names=list("abcde"))

    model_path.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({"model": clf, "features": FEATURES, "classes": CLASSES.tolist()}, model_path)

    print(f"Model saved to: {model_path}")
    print(f"Test accuracy: {acc:.4f}")
    print("\nClassification report:")
    print(report)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train NutriScore model")
    parser.add_argument(
        "--advanced",
        action="store_true",
        help="Train advanced ensemble models using large OpenFoodFacts dataset (backward compatible)",
    )
    args = parser.parse_args()

    if args.advanced:
        from .advanced_training import train_advanced_models

        train_advanced_models()
    else:
        train_model()
