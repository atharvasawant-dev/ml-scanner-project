from __future__ import annotations

from pathlib import Path

import pandas as pd


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_CSV = PROJECT_ROOT / "datasets" / "large_openfoodfacts.csv"
OUTPUT_CSV = PROJECT_ROOT / "datasets" / "large_openfoodfacts_cleaned.csv"
REPORT_PATH = PROJECT_ROOT / "reports" / "data_quality.txt"


def _coerce_numeric(df: pd.DataFrame, cols: list[str]) -> pd.DataFrame:
    for c in cols:
        if c in df.columns:
            df[c] = pd.to_numeric(df[c], errors="coerce")
    return df


def clean_dataset(input_csv: Path = INPUT_CSV, output_csv: Path = OUTPUT_CSV) -> pd.DataFrame:
    df = pd.read_csv(input_csv)
    original_count = len(df)

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
    df = _coerce_numeric(df, numeric_cols)

    df = df.dropna(subset=["calories", "sugar", "salt"])

    df = df[(df["calories"] <= 1000) & (df["sugar"] <= 100)]

    if "saturated_fat" in df.columns:
        df["saturated_fat"] = df["saturated_fat"].fillna(0)
    if "fiber" in df.columns:
        df["fiber"] = df["fiber"].fillna(0)

    df["code"] = df["code"].astype("string").str.strip()
    df["product_name"] = df["product_name"].astype("string").str.strip()

    df = df.drop_duplicates(subset=["code", "product_name"], keep="first")

    final_count = len(df)

    class_dist = {}
    if "nutriscore_grade" in df.columns:
        class_dist = df["nutriscore_grade"].astype("string").str.lower().value_counts(dropna=False).to_dict()

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_csv, index=False)

    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)

    missing_calories = int(pd.isna(pd.to_numeric(pd.read_csv(input_csv)["calories"], errors="coerce")).sum()) if input_csv.exists() else 0

    with REPORT_PATH.open("w", encoding="utf-8") as f:
        f.write("DATA QUALITY REPORT\n")
        f.write("===================\n\n")
        f.write(f"Input file: {input_csv}\n")
        f.write(f"Output file: {output_csv}\n\n")
        f.write(f"Original rows: {original_count}\n")
        f.write(f"Final rows: {final_count}\n")
        f.write(f"Dropped rows: {original_count - final_count}\n\n")
        f.write("Filters applied:\n")
        f.write("- removed rows missing calories/sugar/salt\n")
        f.write("- removed outliers calories>1000 or sugar>100\n")
        f.write("- filled missing saturated_fat=0, fiber=0\n")
        f.write("- removed duplicates by (code, product_name)\n\n")
        if class_dist:
            f.write("NutriScore class distribution (nutriscore_grade):\n")
            for k, v in sorted(class_dist.items(), key=lambda kv: str(kv[0])):
                f.write(f"- {k}: {v}\n")
            f.write("\n")
        f.write(f"Missing calories in raw file (approx): {missing_calories}\n")

    print(f"Original count: {original_count}")
    print(f"Final count: {final_count}")
    print("Class distribution:")
    if class_dist:
        for k, v in sorted(class_dist.items(), key=lambda kv: str(kv[0])):
            print(f"{k}: {v}")
    else:
        print("nutriscore_grade not present")

    return df


def main() -> None:
    clean_dataset()


if __name__ == "__main__":
    main()
