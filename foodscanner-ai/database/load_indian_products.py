from __future__ import annotations

import csv
import sys
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import func, select, text
from sqlalchemy import inspect
from sqlalchemy.orm import Session


sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from database.models import Nutrition, Product  # noqa: E402
from database.orm import SessionLocal, init_db  # noqa: E402


DATASET_PATH = Path(__file__).resolve().parents[1] / "datasets" / "indian_foods" / "indian_packaged_foods.csv"


@dataclass
class ImportStats:
    inserted: int = 0
    skipped: int = 0
    errors: int = 0


def _parse_float(value: str | None) -> float | None:
    if value is None:
        return None
    v = str(value).strip()
    if not v:
        return None
    try:
        return float(v)
    except ValueError:
        return None


def _utc_now_str() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def ensure_brand_column(db: Session) -> None:
    inspector = inspect(db.get_bind())
    columns = {c["name"] for c in inspector.get_columns("products")}
    if "brand" in columns:
        return

    dialect = db.get_bind().dialect.name
    if dialect == "postgresql":
        db.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS brand VARCHAR"))
        db.commit()
        return

    raise RuntimeError(
        "Missing 'brand' column on products table. "
        "This loader can auto-migrate PostgreSQL, but your current dialect is: "
        f"{dialect}. Please add the column manually or run against PostgreSQL."
    )


def load_indian_products(db: Session, csv_path: Path = DATASET_PATH) -> ImportStats:
    stats = ImportStats()

    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found: {csv_path}")

    ensure_brand_column(db)

    with csv_path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                product_name = (row.get("product_name") or "").strip()
                if not product_name:
                    stats.errors += 1
                    continue

                existing = db.scalar(
                    select(Product.id).where(func.lower(Product.product_name) == product_name.lower())
                )
                if existing is not None:
                    stats.skipped += 1
                    continue

                brand = (row.get("brand") or "").strip() or None
                synthetic_barcode = f"IND-{uuid.uuid4().hex}"

                product = Product(
                    barcode=synthetic_barcode,
                    product_name=product_name,
                    brand=brand,
                    nutriscore=None,
                    ingredients=None,
                    additives=None,
                    created_at=_utc_now_str(),
                )
                db.add(product)
                db.flush()

                nutrition = Nutrition(
                    product_id=int(product.id),
                    calories=_parse_float(row.get("calories")),
                    fat=_parse_float(row.get("fat")),
                    sugar=_parse_float(row.get("sugar")),
                    salt=_parse_float(row.get("salt")),
                    protein=_parse_float(row.get("protein")),
                    fiber=_parse_float(row.get("fiber")),
                    carbs=_parse_float(row.get("carbs")),
                )
                db.add(nutrition)

                stats.inserted += 1
            except Exception:
                db.rollback()
                stats.errors += 1

    db.commit()
    return stats


def main() -> None:
    init_db()
    with SessionLocal() as db:
        stats = load_indian_products(db)

    print("Load complete")
    print(f"Products inserted: {stats.inserted}")
    print(f"Products skipped: {stats.skipped}")
    print(f"Errors: {stats.errors}")


if __name__ == "__main__":
    main()
