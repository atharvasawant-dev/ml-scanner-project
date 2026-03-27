from __future__ import annotations

from typing import Any


ADDITIVE_DB: dict[str, dict[str, str]] = {
    "E102": {"name": "Tartrazine", "risk_level": "HIGH", "description": "Synthetic yellow dye; may trigger allergies/hyperactivity in sensitive individuals"},
    "E104": {"name": "Quinoline Yellow", "risk_level": "HIGH", "description": "Synthetic dye; may cause intolerance reactions in some individuals"},
    "E110": {"name": "Sunset Yellow FCF", "risk_level": "HIGH", "description": "Synthetic orange dye; may trigger allergies/hyperactivity in sensitive individuals"},
    "E122": {"name": "Carmoisine", "risk_level": "HIGH", "description": "Synthetic red dye; may cause allergic reactions in sensitive individuals"},
    "E124": {"name": "Ponceau 4R", "risk_level": "HIGH", "description": "Synthetic red dye; associated with intolerance reactions in some people"},
    "E129": {"name": "Allura Red AC", "risk_level": "HIGH", "description": "Synthetic red dye; may be linked to behavioral effects in sensitive children"},
    "E150D": {"name": "Sulphite Ammonia Caramel", "risk_level": "MEDIUM", "description": "Caramel coloring; may contain byproducts of concern at high intake"},
    "E160B": {"name": "Annatto", "risk_level": "MEDIUM", "description": "Natural color; may cause allergic-type reactions in some individuals"},
    "E171": {"name": "Titanium Dioxide", "risk_level": "MEDIUM", "description": "Whitening agent; regulatory scrutiny due to potential genotoxicity concerns"},
    "E172": {"name": "Iron Oxides", "risk_level": "MEDIUM", "description": "Coloring agent; generally considered low risk in typical amounts"},
    "E202": {"name": "Potassium Sorbate", "risk_level": "MEDIUM", "description": "Preservative; may cause irritation in sensitive individuals"},
    "E210": {"name": "Benzoic Acid", "risk_level": "MEDIUM", "description": "Preservative; may cause sensitivity reactions in some people"},
    "E211": {"name": "Sodium Benzoate", "risk_level": "HIGH", "description": "Preservative; may contribute to hyperactivity in some children when combined with certain dyes"},
    "E212": {"name": "Potassium Benzoate", "risk_level": "HIGH", "description": "Preservative; benzoates may cause sensitivity reactions in some individuals"},
    "E213": {"name": "Calcium Benzoate", "risk_level": "HIGH", "description": "Preservative; benzoates may cause sensitivity reactions in some individuals"},
    "E214": {"name": "Ethyl p-Hydroxybenzoate", "risk_level": "HIGH", "description": "Paraben preservative; may have endocrine-related concerns"},
    "E216": {"name": "Propyl p-Hydroxybenzoate", "risk_level": "HIGH", "description": "Paraben preservative; may have endocrine-related concerns"},
    "E220": {"name": "Sulfur Dioxide", "risk_level": "MEDIUM", "description": "Preservative; can trigger asthma/sensitivity in some individuals"},
    "E221": {"name": "Sodium Sulfite", "risk_level": "MEDIUM", "description": "Preservative; may trigger sensitivity reactions in sulfite-sensitive individuals"},
    "E223": {"name": "Sodium Metabisulfite", "risk_level": "MEDIUM", "description": "Preservative; may trigger asthma/sensitivity in some individuals"},
    "E224": {"name": "Potassium Metabisulfite", "risk_level": "MEDIUM", "description": "Preservative; may trigger asthma/sensitivity in some individuals"},
    "E250": {"name": "Sodium Nitrite", "risk_level": "HIGH", "description": "Curing agent; may form nitrosamines under certain conditions"},
    "E251": {"name": "Sodium Nitrate", "risk_level": "HIGH", "description": "Curing agent; can convert to nitrites and contribute to nitrosamine formation"},
    "E282": {"name": "Calcium Propionate", "risk_level": "MEDIUM", "description": "Preservative; may cause irritation or sensitivity in some individuals"},
    "E310": {"name": "Propyl Gallate", "risk_level": "MEDIUM", "description": "Antioxidant; may cause allergic reactions in sensitive individuals"},
    "E311": {"name": "Octyl Gallate", "risk_level": "MEDIUM", "description": "Antioxidant; may cause allergic reactions in sensitive individuals"},
    "E312": {"name": "Dodecyl Gallate", "risk_level": "MEDIUM", "description": "Antioxidant; may cause allergic reactions in sensitive individuals"},
    "E320": {"name": "BHA", "risk_level": "MEDIUM", "description": "Antioxidant; potential health concerns at high exposure"},
    "E321": {"name": "BHT", "risk_level": "MEDIUM", "description": "Antioxidant; potential health concerns at high exposure"},
    "E407": {"name": "Carrageenan", "risk_level": "MEDIUM", "description": "Thickener; may cause GI irritation in sensitive individuals"},
    "E412": {"name": "Guar Gum", "risk_level": "MEDIUM", "description": "Thickener; may cause bloating/GI discomfort in some people"},
    "E415": {"name": "Xanthan Gum", "risk_level": "MEDIUM", "description": "Thickener; may cause GI discomfort in some individuals"},
    "E450": {"name": "Diphosphates", "risk_level": "MEDIUM", "description": "Emulsifier/leavening agent; high intake may affect mineral balance"},
    "E451": {"name": "Triphosphates", "risk_level": "MEDIUM", "description": "Emulsifier; high intake may affect mineral balance"},
    "E452": {"name": "Polyphosphates", "risk_level": "MEDIUM", "description": "Emulsifier; high intake may affect mineral balance"},
    "E466": {"name": "Carboxymethyl Cellulose", "risk_level": "MEDIUM", "description": "Thickener; may affect gut microbiome in some studies"},
    "E471": {"name": "Mono- and Diglycerides of Fatty Acids", "risk_level": "MEDIUM", "description": "Emulsifier; may indicate ultra-processed foods"},
    "E472": {"name": "Esters of Mono- and Diglycerides", "risk_level": "MEDIUM", "description": "Emulsifier; may indicate ultra-processed foods"},
    "E621": {"name": "Monosodium Glutamate", "risk_level": "HIGH", "description": "Flavor enhancer; may cause sensitivity symptoms in some individuals"},
    "E622": {"name": "Monopotassium Glutamate", "risk_level": "HIGH", "description": "Flavor enhancer; glutamates may cause sensitivity symptoms in some individuals"},
    "E623": {"name": "Calcium Diglutamate", "risk_level": "HIGH", "description": "Flavor enhancer; glutamates may cause sensitivity symptoms in some individuals"},
    "E951": {"name": "Aspartame", "risk_level": "HIGH", "description": "Artificial sweetener; not suitable for people with PKU"},
    "E952": {"name": "Cyclamate", "risk_level": "HIGH", "description": "Artificial sweetener; regulatory restrictions vary by country"},
    "E954": {"name": "Saccharin", "risk_level": "HIGH", "description": "Artificial sweetener; may have aftertaste and sensitivity concerns"},
}


def _normalize_code(code: Any) -> str:
    if code is None:
        return ""
    s = str(code).strip().upper()
    if not s:
        return ""
    if s.startswith("EN:"):
        s = s[3:]
    if s.startswith("EN:E"):
        s = s[3:]
    if s.startswith("E") and s[1:].isdigit():
        return s
    if s.startswith("E") and s[1:].replace("D", "").isdigit():
        return s
    return s


def get_additive_info(additive_codes: list[Any]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    seen: set[str] = set()

    for raw_code in additive_codes or []:
        code = _normalize_code(raw_code)
        if not code:
            continue
        if code in seen:
            continue
        seen.add(code)

        info = ADDITIVE_DB.get(code)
        if info is None:
            out.append(
                {
                    "code": code,
                    "name": "Unknown additive",
                    "risk_level": "UNKNOWN",
                    "description": "No additional information available for this additive",
                }
            )
            continue

        out.append(
            {
                "code": code,
                "name": str(info.get("name") or "Unknown additive"),
                "risk_level": str(info.get("risk_level") or "UNKNOWN"),
                "description": str(info.get("description") or "No additional information available"),
            }
        )

    return out
