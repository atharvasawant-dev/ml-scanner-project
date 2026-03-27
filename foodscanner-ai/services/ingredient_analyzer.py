from __future__ import annotations

from typing import Optional


HIGH_RISK_INGREDIENTS = {
    "hydrogenated vegetable oil",
    "partially hydrogenated oil",
    "high fructose corn syrup",
    "interesterified fat",
    "brominated vegetable oil",
}


MEDIUM_HIGH_RISK_INGREDIENTS = {
    "palm oil",
    "corn syrup",
    "artificial sweetener",
    "aspartame",
    "saccharin",
    "acesulfame",
    "sucralose",
    "sodium benzoate",
    "potassium bromate",
    "propyl gallate",
    "tbhq",
    "bha",
    "bht",
    "monosodium glutamate",
    "msg",
    "refined wheat flour",
    "maida",
    "vanaspati",
    "dalda",
    "refined palm olein",
    "artificial colour",
    "artificial color",
    "artificial flavour",
    "artificial flavor",
    "permitted emulsifier",
    "nature identical flavouring",
}


def analyze_ingredients(ingredients_text: Optional[str]) -> dict:
    text = (ingredients_text or "").lower()

    flags: list[str] = []
    high_risk_flags: list[str] = []

    for item in sorted(HIGH_RISK_INGREDIENTS):
        if item in text:
            flags.append(item)
            high_risk_flags.append(item)

    for item in sorted(MEDIUM_HIGH_RISK_INGREDIENTS):
        if item in text:
            flags.append(item)

    if high_risk_flags:
        risk_level = "HIGH"
    else:
        medium_count = len(flags)
        if medium_count == 0:
            risk_level = "LOW"
        elif medium_count == 1:
            risk_level = "MEDIUM"
        else:
            risk_level = "HIGH"

    return {"risk_level": risk_level, "flags": flags, "high_risk_flags": high_risk_flags}
