from __future__ import annotations

import csv
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Optional

import requests
from requests.exceptions import RequestException


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_CSV = PROJECT_ROOT / "datasets" / "large_openfoodfacts.csv"

CATEGORIES = [
    "snacks",
    "breakfast-cereals",
    "biscuits",
    "chocolate",
    "beverages",
    "candies",
    "instant-noodles",
    "dairy-products",
    "nuts",
    "soups",
]

MAX_PAGES_PER_CATEGORY = 50
PAGE_SIZE = 100

RATE_LIMIT_SECONDS = 0.5
MAX_RETRIES = 5
SAVE_EVERY_PAGES = 25


FIELDNAMES = [
    "code",
    "product_name",
    "brands",
    "nutriscore_grade",
    "nova_group",
    "calories",
    "fat",
    "saturated_fat",
    "sugar",
    "salt",
    "protein",
    "fiber",
    "carbs",
    "ingredients_text",
    "additives_tags",
]


@dataclass
class Row:
    code: str
    product_name: str
    brands: str
    nutriscore_grade: str
    nova_group: str
    calories: float
    fat: float
    saturated_fat: float
    sugar: float
    salt: float
    protein: float
    fiber: float
    carbs: float
    ingredients_text: str
    additives_tags: str

    def key(self) -> str:
        return self.code

    def to_csv_row(self) -> dict[str, str]:
        return {
            "code": self.code,
            "product_name": self.product_name,
            "brands": self.brands,
            "nutriscore_grade": self.nutriscore_grade,
            "nova_group": self.nova_group,
            "calories": _num_to_str(self.calories),
            "fat": _num_to_str(self.fat),
            "saturated_fat": _num_to_str(self.saturated_fat),
            "sugar": _num_to_str(self.sugar),
            "salt": _num_to_str(self.salt),
            "protein": _num_to_str(self.protein),
            "fiber": _num_to_str(self.fiber),
            "carbs": _num_to_str(self.carbs),
            "ingredients_text": self.ingredients_text,
            "additives_tags": self.additives_tags,
        }


def _row_from_csv_dict(d: dict[str, str]) -> Optional[Row]:
    code = (d.get("code") or "").strip()
    if not code:
        return None
    product_name = (d.get("product_name") or "").strip()
    brands = (d.get("brands") or "").strip()
    nutriscore_grade = (d.get("nutriscore_grade") or "").strip()
    nova_group = (d.get("nova_group") or "").strip()

    calories = _to_float(d.get("calories"))
    sugar = _to_float(d.get("sugar"))
    salt = _to_float(d.get("salt"))
    if calories is None or sugar is None or salt is None:
        return None

    return Row(
        code=code,
        product_name=product_name,
        brands=brands,
        nutriscore_grade=nutriscore_grade,
        nova_group=nova_group,
        calories=float(calories),
        fat=float(_to_float(d.get("fat")) or 0.0),
        saturated_fat=float(_to_float(d.get("saturated_fat")) or 0.0),
        sugar=float(sugar),
        salt=float(salt),
        protein=float(_to_float(d.get("protein")) or 0.0),
        fiber=float(_to_float(d.get("fiber")) or 0.0),
        carbs=float(_to_float(d.get("carbs")) or 0.0),
        ingredients_text=str(d.get("ingredients_text") or ""),
        additives_tags=str(d.get("additives_tags") or ""),
    )


def load_existing(path: Path = OUTPUT_CSV) -> dict[str, Row]:
    if not path.exists():
        return {}
    try:
        with path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            out: dict[str, Row] = {}
            for r in reader:
                if not isinstance(r, dict):
                    continue
                row = _row_from_csv_dict(r)
                if row is None:
                    continue
                out[row.code] = row
            return out
    except Exception:
        return {}


def _to_float(value: Any) -> Optional[float]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip()
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _num_to_str(value: float) -> str:
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.6g}"


def _is_complete_minimum(row: Row) -> bool:
    return row.calories is not None and row.sugar is not None and row.salt is not None


def _extract_first_str(v: Any) -> str:
    s = str(v or "").strip()
    return s


def _extract_nutriments(nutriments: dict[str, Any]) -> dict[str, Optional[float]]:
    return {
        "calories": _to_float(nutriments.get("energy-kcal_100g")),
        "fat": _to_float(nutriments.get("fat_100g")),
        "saturated_fat": _to_float(nutriments.get("saturated-fat_100g")),
        "sugar": _to_float(nutriments.get("sugars_100g")),
        "salt": _to_float(nutriments.get("salt_100g")),
        "protein": _to_float(nutriments.get("proteins_100g")),
        "fiber": _to_float(nutriments.get("fiber_100g")),
        "carbs": _to_float(nutriments.get("carbohydrates_100g")),
    }


def _row_from_product(p: dict[str, Any]) -> Optional[Row]:
    code = _extract_first_str(p.get("code"))
    if not code:
        return None

    name = _extract_first_str(p.get("product_name"))
    brands = _extract_first_str(p.get("brands"))
    nutriscore_grade = _extract_first_str(p.get("nutriscore_grade")).lower()
    nova_group = _extract_first_str(p.get("nova_group"))
    ingredients_text = _extract_first_str(p.get("ingredients_text"))

    additives = p.get("additives_tags")
    if isinstance(additives, list):
        additives_tags = ",".join(str(x) for x in additives if x is not None)
    else:
        additives_tags = _extract_first_str(additives)

    nutriments = p.get("nutriments") or {}
    n = _extract_nutriments(nutriments)

    if n["calories"] is None or n["sugar"] is None or n["salt"] is None:
        return None

    return Row(
        code=code,
        product_name=name,
        brands=brands,
        nutriscore_grade=nutriscore_grade,
        nova_group=nova_group,
        calories=float(n["calories"]),
        fat=float(n["fat"] or 0.0),
        saturated_fat=float(n["saturated_fat"] or 0.0),
        sugar=float(n["sugar"]),
        salt=float(n["salt"]),
        protein=float(n["protein"] or 0.0),
        fiber=float(n["fiber"] or 0.0),
        carbs=float(n["carbs"] or 0.0),
        ingredients_text=ingredients_text,
        additives_tags=additives_tags,
    )


def _get_with_retries(session: requests.Session, url: str, params: dict[str, Any]) -> Optional[dict[str, Any]]:
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = session.get(url, params=params, timeout=(10.0, 90.0))
            resp.raise_for_status()
            return resp.json()
        except (RequestException, ValueError) as e:
            last_err = e
            retry_after = 0.0
            try:
                if hasattr(e, "response") and getattr(e, "response") is not None:
                    ra = getattr(e.response, "headers", {}).get("Retry-After")
                    if ra is not None:
                        retry_after = float(ra)
            except Exception:
                retry_after = 0.0

            backoff = float(2**attempt)
            jitter = random.uniform(0.0, 0.25)
            time.sleep(max(retry_after, backoff) + jitter)
    if last_err is not None:
        print(f"[warn] request failed after retries: page={params.get('page')} err={type(last_err).__name__}: {last_err}")
    return None


def collect() -> list[Row]:
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "foodscanner-ai/1.0 (large-dataset-collector)",
            "Accept": "application/json",
        }
    )

    base_urls = [
        "https://world.openfoodfacts.org/api/v2/search",
        "https://in.openfoodfacts.org/api/v2/search",
        "https://us.openfoodfacts.org/api/v2/search",
    ]

    rows_by_code: dict[str, Row] = load_existing(OUTPUT_CSV)
    if rows_by_code:
        print(f"[info] resume: loaded existing rows={len(rows_by_code)} from {OUTPUT_CSV}")

    total_pages = len(CATEGORIES) * MAX_PAGES_PER_CATEGORY
    pages_done = 0

    for category in CATEGORIES:
        for page in range(1, MAX_PAGES_PER_CATEGORY + 1):
            params = {
                "page": page,
                "page_size": PAGE_SIZE,
                "categories_tags": category,
                "fields": "code,product_name,brands,nutriscore_grade,nova_group,nutriments,ingredients_text,additives_tags",
            }

            data = None
            for u in base_urls:
                data = _get_with_retries(session, u, params)
                if data is not None:
                    break
            pages_done += 1

            if data is None:
                time.sleep(RATE_LIMIT_SECONDS)
                continue

            products = data.get("products") or []
            added = 0
            for p in products:
                if not isinstance(p, dict):
                    continue
                row = _row_from_product(p)
                if row is None:
                    continue
                if not _is_complete_minimum(row):
                    continue
                if row.code in rows_by_code:
                    continue
                rows_by_code[row.code] = row
                added += 1

            if page % 10 == 0:
                print(
                    f"[progress] category={category} page={page}/{MAX_PAGES_PER_CATEGORY} "
                    f"pages_done={pages_done}/{total_pages} unique_products={len(rows_by_code)} last_added={added}"
                )

            if pages_done % SAVE_EVERY_PAGES == 0 and rows_by_code:
                try:
                    save_csv(list(rows_by_code.values()), OUTPUT_CSV)
                    print(f"[info] checkpoint saved: {OUTPUT_CSV} rows={len(rows_by_code)}")
                except Exception as e:
                    print(f"[warn] checkpoint save failed: {e}")

            time.sleep(RATE_LIMIT_SECONDS)

    return list(rows_by_code.values())


def save_csv(rows: list[Row], path: Path = OUTPUT_CSV) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    rows_sorted = sorted(rows, key=lambda r: r.code)

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        writer.writeheader()
        for r in rows_sorted:
            writer.writerow(r.to_csv_row())


def main() -> None:
    rows = collect()
    print(f"Collected unique products: {len(rows)}")
    save_csv(rows)
    print(f"Saved to: {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
