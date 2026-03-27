from __future__ import annotations

import time
from typing import Any

import requests

from sqlalchemy import select

from database.db_session import SessionLocal
from database.models import Nutrition, Product


OFF_URL = (
    "https://world.openfoodfacts.org/api/v2/search"
    "?categories_tags=en:indian-foods"
    "&fields=code,product_name,brands,nutriscore_grade,nutriments,ingredients_text,additives_tags"
    "&page_size=100"
    "&page={page}"
)


def _to_float(value: Any) -> float | None:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _get_page(page: int, retries: int = 3, timeout_s: int = 20) -> dict[str, Any]:
    last_err: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(OFF_URL.format(page=page), timeout=timeout_s)
            resp.raise_for_status()
            return resp.json()
        except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as e:
            last_err = e
            if attempt < retries:
                time.sleep(1.5 * attempt)
                continue
            raise
    if last_err:
        raise last_err
    return {}


def _upsert_product(db, product: dict[str, Any]) -> bool:
    code = str(product.get("code") or "").strip()
    name = str(product.get("product_name") or "").strip()

    if not code or not name:
        return False

    existing = db.execute(select(Product.id).where(Product.barcode == code)).scalar_one_or_none()
    if existing is not None:
        return False

    nutriments = product.get("nutriments") or {}
    if not isinstance(nutriments, dict):
        nutriments = {}

    brands = product.get("brands")
    brand = None
    if isinstance(brands, str) and brands.strip():
        brand = brands.strip()

    p = Product(
        barcode=code,
        product_name=name,
        brand=brand,
        nutriscore=(str(product.get("nutriscore_grade")).upper() if product.get("nutriscore_grade") else None),
        ingredients=product.get("ingredients_text"),
        additives=",".join(product.get("additives_tags") or []) if isinstance(product.get("additives_tags"), list) else None,
        created_at=time.strftime("%Y-%m-%d %H:%M:%S", time.gmtime()),
    )
    db.add(p)
    db.flush()

    n = Nutrition(
        product_id=int(p.id),
        calories=_to_float(nutriments.get("energy-kcal_100g") or nutriments.get("energy-kcal")),
        fat=_to_float(nutriments.get("fat_100g") or nutriments.get("fat")),
        sugar=_to_float(nutriments.get("sugars_100g") or nutriments.get("sugars")),
        salt=_to_float(nutriments.get("salt_100g") or nutriments.get("salt")),
        protein=_to_float(nutriments.get("proteins_100g") or nutriments.get("proteins")),
        fiber=_to_float(nutriments.get("fiber_100g") or nutriments.get("fiber")),
        carbs=_to_float(nutriments.get("carbohydrates_100g") or nutriments.get("carbohydrates")),
    )
    db.add(n)
    return True


def main() -> None:
    inserted = 0
    skipped = 0
    processed = 0

    db = SessionLocal()
    try:
        for page in range(1, 51):
            data = _get_page(page)
            products = data.get("products") or []
            if not isinstance(products, list):
                products = []

            for prod in products:
                processed += 1
                if not isinstance(prod, dict):
                    skipped += 1
                    continue

                # Filter: skip rows missing both product_name and code
                code = str(prod.get("code") or "").strip()
                name = str(prod.get("product_name") or "").strip()
                if not code and not name:
                    skipped += 1
                    continue

                if not code or not name:
                    skipped += 1
                    continue

                ok = _upsert_product(db, prod)
                if ok:
                    inserted += 1
                else:
                    skipped += 1

                if processed % 100 == 0:
                    db.commit()
                    print(
                        f"Processed {processed} | Inserted {inserted} | Skipped {skipped} | Current page {page}/50"
                    )

            db.commit()
            print(f"Finished page {page}/50 | Total inserted so far: {inserted}")

    finally:
        db.close()

    print(f"DONE. Processed={processed} Inserted={inserted} Skipped={skipped}")


if __name__ == "__main__":
    main()
