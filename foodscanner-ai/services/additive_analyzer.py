from __future__ import annotations

from typing import Optional

from services.additive_knowledge_base import get_additive_info


HIGH_RISK_ADDITIVES = {
    "en:e102",
    "en:e104",
    "en:e110",
    "en:e122",
    "en:e124",
    "en:e129",
    "en:e211",
    "en:e212",
    "en:e213",
    "en:e214",
    "en:e216",
    "en:e250",
    "en:e251",
    "en:e621",
    "en:e622",
    "en:e623",
    "en:e951",
    "en:e952",
    "en:e954",
}


MEDIUM_RISK_ADDITIVES = {
    "en:e150d",
    "en:e160b",
    "en:e171",
    "en:e172",
    "en:e202",
    "en:e210",
    "en:e220",
    "en:e221",
    "en:e223",
    "en:e224",
    "en:e282",
    "en:e310",
    "en:e311",
    "en:e312",
    "en:e320",
    "en:e321",
    "en:e407",
    "en:e412",
    "en:e415",
    "en:e450",
    "en:e451",
    "en:e452",
    "en:e466",
    "en:e471",
    "en:e472",
}


def _normalize_token(token: str) -> str:
    t = (token or "").strip().lower()
    if not t:
        return ""
    if t.startswith("en:"):
        return t
    if t.startswith("e"):
        return "en:" + t
    return t


def analyze_additives(additives_string: Optional[str]) -> dict:
    raw = (additives_string or "").strip().lower()

    high_flags: list[str] = []
    medium_flags: list[str] = []

    if raw:
        for token in raw.split(","):
            t = _normalize_token(token)
            if not t:
                continue
            if t in HIGH_RISK_ADDITIVES and t not in high_flags:
                high_flags.append(t)
            elif t in MEDIUM_RISK_ADDITIVES and t not in medium_flags:
                medium_flags.append(t)

    if high_flags:
        risk_level = "HIGH"
    elif medium_flags:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    high_risk_count = len(high_flags)
    medium_risk_count = len(medium_flags)

    # get_additive_info expects normalized codes; it supports en:e### and E###.
    enriched = get_additive_info(high_flags + medium_flags)
    items = [
        {
            "code": a.get("code"),
            "name": a.get("name"),
            "risk_level": a.get("risk_level"),
        }
        for a in enriched
    ]

    return {
        "risk_level": risk_level,
        "additives": items,
        "high_risk_count": high_risk_count,
        "medium_risk_count": medium_risk_count,
    }
