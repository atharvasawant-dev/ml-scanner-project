from __future__ import annotations

import argparse
import os
from pathlib import Path
from typing import Optional

import pandas as pd
import requests
from tqdm import tqdm


REQUIRED_COLUMNS = [
    "code",
    "product_name",
    "nutriscore_grade",
    "energy-kcal_100g",
    "fat_100g",
    "sugars_100g",
    "salt_100g",
    "protein_100g",
    "fiber_100g",
    "carbohydrates_100g",
]

RENAME_MAP = {
    "code": "barcode",
    "energy-kcal_100g": "calories",
    "fat_100g": "fat",
    "sugars_100g": "sugar",
    "salt_100g": "salt",
    "protein_100g": "protein",
    "fiber_100g": "fiber",
    "carbohydrates_100g": "carbs",
}


DEFAULT_DATASET_URL = "https://static.openfoodfacts.org/data/en.openfoodfacts.org.products.csv"


def _download_file(url: str, dest: Path, chunk_bytes: int = 1024 * 1024) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp_path = dest.with_suffix(dest.suffix + ".part")

    existing_bytes = tmp_path.stat().st_size if tmp_path.exists() else 0
    headers: dict[str, str] = {}
    if existing_bytes > 0:
        headers["Range"] = f"bytes={existing_bytes}-"

    with requests.get(url, stream=True, headers=headers, timeout=60) as r:
        r.raise_for_status()

        total_size: Optional[int] = None
        content_length = r.headers.get("Content-Length")
        if content_length is not None:
            try:
                total_size = int(content_length) + existing_bytes
            except ValueError:
                total_size = None

        mode = "ab" if existing_bytes > 0 else "wb"
        with open(tmp_path, mode) as f, tqdm(
            total=total_size,
            initial=existing_bytes,
            unit="B",
            unit_scale=True,
            desc="Downloading dataset",
        ) as pbar:
            for block in r.iter_content(chunk_size=chunk_bytes):
                if not block:
                    continue
                f.write(block)
                pbar.update(len(block))

    os.replace(tmp_path, dest)


def ensure_dataset_present(input_csv: Path, url: str) -> None:
    if input_csv.exists():
        return

    print(f"Dataset not found at: {input_csv}")
    print(f"Downloading (~2GB) from: {url}")
    _download_file(url=url, dest=input_csv)


def _clean_chunk(chunk: pd.DataFrame) -> pd.DataFrame:
    chunk = chunk.rename(columns=RENAME_MAP)

    if "barcode" in chunk.columns:
        chunk["barcode"] = (
            chunk["barcode"].astype("string").str.strip().replace({"": pd.NA})
        )
    if "product_name" in chunk.columns:
        chunk["product_name"] = (
            chunk["product_name"].astype("string").str.strip().replace({"": pd.NA})
        )

    chunk = chunk.dropna(subset=["barcode", "product_name"])

    if "nutriscore_grade" in chunk.columns:
        chunk["nutriscore_grade"] = (
            chunk["nutriscore_grade"]
            .astype("string")
            .str.strip()
            .str.lower()
            .replace({"": pd.NA})
        )

    numeric_cols = ["calories", "fat", "sugar", "salt", "protein", "fiber", "carbs"]
    for col in numeric_cols:
        if col in chunk.columns:
            chunk[col] = pd.to_numeric(chunk[col], errors="coerce")

    return chunk


def prepare_dataset(
    input_csv: Path,
    output_csv: Path,
    chunksize: int,
    dataset_url: str,
) -> None:
    ensure_dataset_present(input_csv, dataset_url)

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    if output_csv.exists():
        output_csv.unlink()

    dtype = {
        "code": "string",
        "product_name": "string",
        "nutriscore_grade": "string",
        "energy-kcal_100g": "float64",
        "fat_100g": "float64",
        "sugars_100g": "float64",
        "salt_100g": "float64",
        "protein_100g": "float64",
        "fiber_100g": "float64",
        "carbohydrates_100g": "float64",
    }

    total_rows = 0
    valid_rows = 0
    nutriscore_present = 0

    first_write = True

    reader = pd.read_csv(
        input_csv,
        usecols=REQUIRED_COLUMNS,
        dtype=dtype,
        chunksize=chunksize,
        low_memory=False,
        encoding_errors="replace",
    )

    for chunk in reader:
        total_rows += len(chunk)
        cleaned = _clean_chunk(chunk)

        valid_rows += len(cleaned)
        if "nutriscore_grade" in cleaned.columns:
            nutriscore_present += cleaned["nutriscore_grade"].notna().sum()

        cleaned.to_csv(output_csv, mode="w" if first_write else "a", index=False, header=first_write)
        first_write = False

    nutriscore_missing = valid_rows - nutriscore_present
    pct_with_nutriscore = (nutriscore_present / valid_rows * 100.0) if valid_rows else 0.0

    print("Dataset preparation complete")
    print(f"Rows processed: {total_rows}")
    print(f"Valid products saved: {valid_rows}")
    print(f"Products with NutriScore: {nutriscore_present} ({pct_with_nutriscore:.2f}%)")
    print(f"Products missing NutriScore: {nutriscore_missing}")
    print(f"Output written to: {output_csv}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare Open Food Facts dataset for nutrition analysis")
    parser.add_argument(
        "--input",
        type=Path,
        default=Path(__file__).resolve().parent / "en.openfoodfacts.org.products.csv",
        help="Path to Open Food Facts CSV input",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parent / "clean_food_data.csv",
        help="Path to cleaned CSV output",
    )
    parser.add_argument(
        "--chunksize",
        type=int,
        default=200_000,
        help="Number of rows per chunk",
    )
    parser.add_argument(
        "--dataset-url",
        type=str,
        default=DEFAULT_DATASET_URL,
        help="Download URL used if the input CSV is missing",
    )

    args = parser.parse_args()
    prepare_dataset(args.input, args.output, args.chunksize, args.dataset_url)


if __name__ == "__main__":
    main()
