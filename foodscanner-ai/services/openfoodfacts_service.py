from __future__ import annotations

from typing import Any, Optional

import requests
from requests import HTTPError, RequestException


API_URL_TEMPLATE = "https://world.openfoodfacts.org/api/v0/product/{barcode}.json"
API_V2_URL_TEMPLATE = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def fetch_product_by_barcode(barcode: str, timeout: float = 15.0) -> Optional[dict[str, Any]]:
    url = API_URL_TEMPLATE.format(barcode=barcode)
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "foodscanner-ai/1.0 (+https://example.com)"},
        )
        resp.raise_for_status()
        data = resp.json()
    except (RequestException, HTTPError, ValueError):
        return None

    if not isinstance(data, dict):
        return None

    if data.get("status") != 1:
        return None

    product = data.get("product")
    if not isinstance(product, dict):
        return None

    nutriments = product.get("nutriments")
    if not isinstance(nutriments, dict):
        nutriments = {}

    additives_tags = product.get("additives_tags")
    additives: Optional[str]
    if isinstance(additives_tags, list):
        additives = ",".join(str(x).strip() for x in additives_tags if str(x).strip()) or None
    else:
        additives = None

    normalized: dict[str, Any] = {
        "barcode": str(barcode),
        "product_name": product.get("product_name") or product.get("product_name_en"),
        "nutriscore": product.get("nutriscore_grade"),
        "ingredients": product.get("ingredients_text"),
        "additives": additives,
        "calories": _to_float(nutriments.get("energy-kcal_100g")),
        "fat": _to_float(nutriments.get("fat_100g")),
        "sugar": _to_float(nutriments.get("sugars_100g")),
        "salt": _to_float(nutriments.get("salt_100g")),
        "protein": _to_float(nutriments.get("proteins_100g")),
        "fiber": _to_float(nutriments.get("fiber_100g")),
        "carbs": _to_float(nutriments.get("carbohydrates_100g")),
    }

    if normalized["product_name"] is None:
        return None

    for k in ("product_name", "nutriscore", "ingredients", "additives"):
        if normalized.get(k) is not None:
            normalized[k] = str(normalized[k]).strip() or None

    return normalized


def fetch_product_by_barcode_v2(barcode: str, timeout: float = 15.0) -> Optional[dict[str, Any]]:
    url = API_V2_URL_TEMPLATE.format(barcode=barcode)
    try:
        resp = requests.get(
            url,
            timeout=timeout,
            headers={"User-Agent": "foodscanner-ai/1.0 (+https://example.com)"},
        )
        resp.raise_for_status()
        data = resp.json()
    except (RequestException, HTTPError, ValueError):
        return None

    product = data.get("product")
    if not isinstance(product, dict):
        return None

    nutriments = product.get("nutriments")
    if not isinstance(nutriments, dict):
        nutriments = {}

    additives_tags = product.get("additives_tags")
    additives: Optional[str]
    if isinstance(additives_tags, list):
        additives = ",".join(str(x).strip() for x in additives_tags if str(x).strip()) or None
    else:
        additives = None

    normalized: dict[str, Any] = {
        "barcode": str(barcode),
        "product_name": product.get("product_name") or product.get("product_name_en"),
        "nutriscore": product.get("nutriscore_grade"),
        "ingredients": product.get("ingredients_text"),
        "additives": additives,
        "calories": _to_float(nutriments.get("energy-kcal_100g")),
        "fat": _to_float(nutriments.get("fat_100g")),
        "sugar": _to_float(nutriments.get("sugars_100g")),
        "salt": _to_float(nutriments.get("salt_100g")),
        "protein": _to_float(nutriments.get("proteins_100g")),
        "fiber": _to_float(nutriments.get("fiber_100g")),
        "carbs": _to_float(nutriments.get("carbohydrates_100g")),
    }

    if normalized["product_name"] is None:
        return None

    for k in ("product_name", "nutriscore", "ingredients", "additives"):
        if normalized.get(k) is not None:
            normalized[k] = str(normalized[k]).strip() or None

    return normalized
