from __future__ import annotations

import csv
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import requests
from requests import Response
from requests.exceptions import RequestException


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATASET_PATH = PROJECT_ROOT / "datasets" / "indian_foods" / "indian_packaged_foods.csv"

SAVE_EVERY_NEW_PRODUCTS = 10

REQUIRED_HEADER = [
    "product_name",
    "brand",
    "calories",
    "fat",
    "sugar",
    "salt",
    "protein",
    "fiber",
    "carbs",
]


@dataclass
class Row:
    product_name: str
    brand: str
    calories: float | None
    fat: float | None
    sugar: float | None
    salt: float | None
    protein: float | None
    fiber: float | None
    carbs: float | None

    def key(self) -> tuple[str, str]:
        return (self.product_name.strip().lower(), self.brand.strip().lower())

    def completeness_score(self) -> int:
        vals = [
            self.calories,
            self.fat,
            self.sugar,
            self.salt,
            self.protein,
            self.fiber,
            self.carbs,
        ]
        return sum(1 for v in vals if v is not None)

    def to_csv_row(self) -> dict[str, str]:
        return {
            "product_name": self.product_name,
            "brand": self.brand,
            "calories": _num_to_str(self.calories),
            "fat": _num_to_str(self.fat),
            "sugar": _num_to_str(self.sugar),
            "salt": _num_to_str(self.salt),
            "protein": _num_to_str(self.protein),
            "fiber": _num_to_str(self.fiber),
            "carbs": _num_to_str(self.carbs),
        }


def _to_float(value: Any) -> float | None:
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


def _num_to_str(value: float | None) -> str:
    if value is None:
        return ""
    if abs(value - round(value)) < 1e-9:
        return str(int(round(value)))
    return f"{value:.6g}"


def _is_complete(row: Row) -> bool:
    return (
        row.calories is not None
        and row.fat is not None
        and row.sugar is not None
        and row.salt is not None
        and row.protein is not None
        and row.fiber is not None
        and row.carbs is not None
    )


def _best_row(a: Row, b: Row) -> Row:
    sa = a.completeness_score()
    sb = b.completeness_score()
    if sb > sa:
        return b
    if sa > sb:
        return a

    def _sum(r: Row) -> float:
        return float(sum(v or 0.0 for v in [r.calories, r.fat, r.sugar, r.salt, r.protein, r.fiber, r.carbs]))

    return b if _sum(b) > _sum(a) else a


def load_existing_csv(path: Path) -> list[Row]:
    if not path.exists():
        return []

    rows: list[Row] = []
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames is None:
            return []
        header = [h.strip() for h in reader.fieldnames]
        if header != REQUIRED_HEADER:
            raise ValueError(
                "Unexpected dataset header. "
                f"Expected: {REQUIRED_HEADER}. Got: {header}."
            )

        for r in reader:
            product_name = (r.get("product_name") or "").strip()
            brand = (r.get("brand") or "").strip()
            if not product_name:
                continue
            if not brand:
                brand = "Unknown"

            rows.append(
                Row(
                    product_name=product_name,
                    brand=brand,
                    calories=_to_float(r.get("calories")),
                    fat=_to_float(r.get("fat")),
                    sugar=_to_float(r.get("sugar")),
                    salt=_to_float(r.get("salt")),
                    protein=_to_float(r.get("protein")),
                    fiber=_to_float(r.get("fiber")),
                    carbs=_to_float(r.get("carbs")),
                )
            )

    return rows


def _extract_brand(brands_field: Any) -> str:
    s = str(brands_field or "").strip()
    if not s:
        return "Unknown"
    return s.split(",")[0].strip() or "Unknown"


def row_from_off_product(p: dict[str, Any]) -> Row | None:
    name = str(p.get("product_name") or "").strip()
    if not name:
        return None

    brand = _extract_brand(p.get("brands"))

    nutr = p.get("nutriments") or {}
    calories = _to_float(nutr.get("energy-kcal_100g"))
    fat = _to_float(nutr.get("fat_100g"))
    sugar = _to_float(nutr.get("sugars_100g"))
    salt = _to_float(nutr.get("salt_100g"))
    protein = _to_float(nutr.get("proteins_100g"))
    fiber = _to_float(nutr.get("fiber_100g"))
    carbs = _to_float(nutr.get("carbohydrates_100g"))

    return Row(
        product_name=name,
        brand=brand,
        calories=calories,
        fat=fat,
        sugar=sugar,
        salt=salt,
        protein=protein,
        fiber=fiber,
        carbs=carbs,
    )


def fetch_off_products(
    *,
    country_tag: str,
    category_tag: str,
    page_size: int = 50,
    max_pages: int = 30,
    sleep_seconds: float = 0.2,
    timeout_seconds: float = 120.0,
    max_retries: int = 5,
) -> list[Row]:
    """Fetch products from OpenFoodFacts search endpoint.

    We use `tagtype_0=countries` and `tag_0=in` for India, and one category tag.
    """

    rows: list[Row] = []
    session = requests.Session()

    session.headers.update(
        {
            "User-Agent": "foodscanner-ai/1.0 (dataset-builder; +https://example.com)",
            "Accept": "application/json",
        }
    )

    primary_base_url = os.environ.get("OFF_BASE_URL", "https://world.openfoodfacts.org").rstrip("/")
    base_urls = [
        primary_base_url,
        "https://in.openfoodfacts.org",
        "https://world.openfoodfacts.org",
    ]

    urls = [b.rstrip("/") + "/api/v2/search" for b in base_urls]

    def _get_with_retries(*, params: dict[str, Any]) -> Response | None:
        last_err: Exception | None = None
        for attempt in range(max_retries):
            for u in urls:
                try:
                    resp = session.get(u, params=params, timeout=(10.0, timeout_seconds))
                    resp.raise_for_status()
                    return resp
                except RequestException as e:
                    last_err = e
            backoff = float(2**attempt)
            time.sleep(backoff)
        if last_err is not None:
            print(
                f"[warn] OFF request failed: category={category_tag} page={params.get('page')} skipped ({type(last_err).__name__}: {last_err})"
            )
        return None

    for page in range(1, max_pages + 1):
        print(f"[info] OFF fetch: category={category_tag} page={page}")
        params = {
            "page": page,
            "page_size": page_size,
            "fields": "product_name,brands,nutriments",
            "country": country_tag,
            "categories_tags": category_tag,
        }

        resp = _get_with_retries(params=params)
        if resp is None:
            continue

        try:
            data = resp.json()
        except ValueError as e:
            print(f"[warn] OFF returned invalid json: category={category_tag} page={page} err={e}")
            continue

        products = data.get("products") or []
        if not products:
            break

        page_added = 0
        for p in products:
            if not isinstance(p, dict):
                continue
            row = row_from_off_product(p)
            if row is None:
                continue
            rows.append(row)
            page_added += 1

        print(f"[info] OFF fetched: category={category_tag} page={page} added={page_added}")

        time.sleep(sleep_seconds)

    return rows


def dedupe_rows(rows: list[Row]) -> list[Row]:
    best_by_key: dict[tuple[str, str], Row] = {}

    for r in rows:
        k = r.key()
        existing = best_by_key.get(k)
        if existing is None:
            best_by_key[k] = r
        else:
            best_by_key[k] = _best_row(existing, r)

    return list(best_by_key.values())


def write_csv(path: Path, rows: list[Row]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    rows_sorted = sorted(rows, key=lambda r: (r.brand.lower(), r.product_name.lower()))

    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=REQUIRED_HEADER)
        writer.writeheader()
        for r in rows_sorted:
            writer.writerow(r.to_csv_row())


def print_stats(rows: list[Row]) -> None:
    brands = {r.brand.strip().lower() for r in rows if r.brand.strip()}
    complete = sum(1 for r in rows if _is_complete(r))

    print("Dataset successfully expanded")
    print(f"Products: {len(rows)}")
    print(f"Brands: {len(brands)}")
    print(f"Complete nutrition rows: {complete}")


def main() -> None:
    existing = load_existing_csv(DATASET_PATH)

    # OpenFoodFacts uses country tag 'in' for India.
    country_tag = "in"

    category_tags = [
        "snacks",
        "biscuits",
        "noodles",
        "chips",
        "breakfast-cereals",
        "instant-foods",
        "beverages",
    ]

    env_page_size = _to_float(os.environ.get("OFF_PAGE_SIZE"))
    env_max_pages = _to_float(os.environ.get("OFF_MAX_PAGES"))
    page_size = int(env_page_size) if env_page_size is not None else 50
    max_pages = int(env_max_pages) if env_max_pages is not None else 30

    fetched: list[Row] = []
    pending_since_save = 0
    try:
        for cat in category_tags:
            try:
                new_rows = fetch_off_products(
                    country_tag=country_tag,
                    category_tag=cat,
                    page_size=page_size,
                    max_pages=max_pages,
                )
                fetched.extend(new_rows)
                pending_since_save += len(new_rows)

                if pending_since_save >= SAVE_EVERY_NEW_PRODUCTS and fetched:
                    combined_partial = dedupe_rows(existing + fetched)
                    write_csv(DATASET_PATH, combined_partial)
                    print_stats(combined_partial)
                    existing = combined_partial
                    fetched = []
                    pending_since_save = 0

                if new_rows and fetched:
                    combined_partial = dedupe_rows(existing + fetched)
                    write_csv(DATASET_PATH, combined_partial)
                    print_stats(combined_partial)
                    existing = combined_partial
                    fetched = []
                    pending_since_save = 0
            except Exception as e:  # defensive: dataset builder should not hard-fail
                print(f"[warn] category fetch failed: category={cat} err={e}")
    except KeyboardInterrupt:
        combined_partial = dedupe_rows(existing + fetched)
        write_csv(DATASET_PATH, combined_partial)
        print_stats(combined_partial)
        raise

    combined = dedupe_rows(existing + fetched)

    # If you want to be more aggressive about preferring complete rows, you can add
    # more category tags or increase max_pages.
    write_csv(DATASET_PATH, combined)
    print_stats(combined)


if __name__ == "__main__":
    main()
