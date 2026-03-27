from __future__ import annotations

from pathlib import Path
import base64
import re
import io
import logging

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, select
from datetime import date

from database.db_session import get_db
from database.orm import init_db as orm_init_db
from database.models import FoodLog, ScanHistory, User
from services.barcode_lookup import lookup_product
from services.product_search import search_products
from services.recommendation_engine import get_healthier_alternatives
from services import db_service
from services.health_report import generate_daily_report
from services.score_explainer import explain_score
from services.goal_report import generate_goal_report
from services.auth_service import create_access_token, get_current_user, hash_password, verify_password
from services.ingredient_analyzer import analyze_ingredients
from services.additive_analyzer import analyze_additives
from services.food_health_score import compute_food_health_score
from services.final_decision_engine import compute_final_decision
from services.decision_explainer import build_decision_reasons

import pandas as pd
from rapidfuzz import fuzz


app = FastAPI(title="FoodScanner AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    barcode: str = Field(..., pattern=r"^\d{8,14}$")
    product_name: str | None = None


class CompareRequest(BaseModel):
    product_a: str
    product_b: str


class AnalyzeRequest(BaseModel):
    product_name: str
    calories: float | None = None
    fat: float | None = None
    sugar: float | None = None
    salt: float | None = None
    protein: float | None = None
    fiber: float | None = None
    carbs: float | None = None
    serving_size: float | None = None


class OCRRequest(BaseModel):
    image_base64: str


class FoodLogRequest(BaseModel):
    product_name: str
    calories: float = 0


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    name: str | None = None
    daily_calorie_limit: int = 2000


class LoginRequest(BaseModel):
    email: str
    password: str


class UserProfileUpdateRequest(BaseModel):
    name: str | None = None
    daily_calorie_limit: int | None = None
    diet_type: str | None = None
    goal_type: str | None = None
    goal_target_days: int | None = None


def _to_float(value: object) -> float | None:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _pct_less(a: float | None, b: float | None) -> int | None:
    if a is None or b is None or a == 0:
        return None
    if b >= a:
        return None
    return int(round(((a - b) / a) * 100))


def _pct_more(a: float | None, b: float | None) -> int | None:
    if a is None or b is None or a == 0:
        return None
    if b <= a:
        return None
    return int(round(((b - a) / a) * 100))


def _csv_fuzzy_lookup(name: str, threshold: float = 75.0) -> dict | None:
    q = (name or "").strip()
    if not q:
        return None

    try:
        df = pd.read_csv(Path(__file__).resolve().parents[1] / "datasets" / "indian_foods" / "indian_packaged_foods.csv")
    except Exception:
        return None

    if "product_name" not in df.columns:
        return None

    best_row = None
    best_name = None
    best_score = 0.0
    for _, row in df.iterrows():
        candidate = str(row.get("product_name") or "").strip()
        if not candidate:
            continue
        score = max(
            float(fuzz.token_set_ratio(q.lower(), candidate.lower())),
            float(fuzz.partial_ratio(q.lower(), candidate.lower())),
        )
        if score > best_score:
            best_score = score
            best_row = row
            best_name = candidate

    if best_row is None or best_score < float(threshold):
        return None

    def _f(v: object) -> float | None:
        return _to_float(v)

    return {
        "product_name": best_name,
        "calories": _f(best_row.get("calories")),
        "fat": _f(best_row.get("fat")),
        "sugar": _f(best_row.get("sugar")),
        "salt": _f(best_row.get("salt")),
        "protein": _f(best_row.get("protein")),
        "fiber": _f(best_row.get("fiber")),
        "carbs": _f(best_row.get("carbs")),
        "ingredients": None,
        "additives": None,
        "source": "indian_dataset",
        "_match": {
            "query": q,
            "matched_name": best_name,
            "similarity": best_score,
            "source": "indian_dataset_fuzzy",
        },
    }


def _ocr_extract_text(image_bytes: bytes) -> str:
    # Prefer easyocr (far better for nutrition labels). Fall back to pytesseract.
    try:
        import numpy as np
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        arr = np.array(img)

        reader = _get_easyocr_reader()
        parts = reader.readtext(arr, detail=0)
        text = "\n".join([str(p) for p in parts if p])
        if text.strip():
            return text
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"easyocr failed: {e}")

    try:
        from PIL import Image
    except Exception as e:
        raise HTTPException(status_code=501, detail="Pillow is not installed") from e

    try:
        import pytesseract
    except Exception as e:
        raise HTTPException(status_code=501, detail="pytesseract is not installed") from e

    try:
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as e:
        raise HTTPException(status_code=400, detail="invalid image") from e

    try:
        from PIL import ImageOps

        img = ImageOps.exif_transpose(img)
        img = img.convert("L")
        img = ImageOps.autocontrast(img)
        # Upscale for better OCR on small labels
        img = img.resize((img.size[0] * 2, img.size[1] * 2))
        # Simple threshold
        img = img.point(lambda p: 255 if p > 160 else 0)

        # Try multiple page segmentation modes and pick the best.
        def score_text(t: str) -> tuple[int, int]:
            # Prefer text with digits and keywords (nutrition labels)
            digits = sum(ch.isdigit() for ch in (t or ""))
            keywords = sum(1 for k in ["kcal", "energy", "fat", "protein", "sugar", "salt", "carb"] if k in (t or "").lower())
            return (digits, keywords)

        t1 = pytesseract.image_to_string(img, config="--oem 3 --psm 6")
        t2 = pytesseract.image_to_string(img, config="--oem 3 --psm 4")
        text = t1 if score_text(t1) >= score_text(t2) else t2
    except Exception as e:
        logger = logging.getLogger(__name__)
        logger.error(f"pytesseract failed: {e}")
        return ""

    return str(text or "")


def _parse_nutrition_from_text(text: str) -> dict:
    text_lower = (text or "").lower()
    # Keep newlines for label-style parsing; also keep a flattened version.
    text_lines = [ln.strip() for ln in re.split(r"\r?\n", text_lower) if ln.strip()]
    flat = re.sub(r"\s+", " ", text_lower)

    # Normalize common OCR confusions
    def _norm(s: str) -> str:
        s = (s or "").lower()
        s = s.replace("kca|", "kcal").replace("kca1", "kcal").replace("keal", "kcal").replace("kcai", "kcal")
        s = s.replace("kcall", "kcal").replace("kcal.", "kcal")
        s = s.replace("energve", "energy").replace("enerqv", "energy")
        s = s.replace("larbohydrate", "carbohydrate").replace("carbohvdrate", "carbohydrate")
        s = s.replace("proteln", "protein").replace("sugars", "sugar")
        # OCR often uses comma for decimal
        s = re.sub(r"(\d),(\d)", r"\1.\2", s)
        return s

    text_lines = [_norm(ln) for ln in text_lines]
    flat = _norm(flat)

    def _to_num(v: str) -> float | None:
        try:
            return float(v)
        except Exception:
            return None

    def _prefer_decimal(a: float | None, b: float | None) -> float | None:
        if a is None:
            return b
        if b is None:
            return a
        # If one looks like a decimal and the other like an integer-scaled value, prefer decimal.
        if 0 < a < 1 and b >= 1:
            return a
        if 0 < b < 1 and a >= 1:
            return b
        # Otherwise prefer the smaller one (common OCR: 0.4 becomes 4)
        return a if a <= b else b

    def _find_line_value(label_patterns: list[str], value_pattern: str = r"(\d+(?:\.\d+)?)") -> float | None:
        for ln in text_lines:
            for lp in label_patterns:
                if re.search(lp, ln, flags=re.IGNORECASE):
                    m = re.search(rf"{lp}[^\d]*{value_pattern}", ln, flags=re.IGNORECASE)
                    if m:
                        return _to_num(m.group(1))
        return None

    def _find_nextline_value(label_patterns: list[str], value_pattern: str = r"(\d+(?:\.\d+)?)") -> float | None:
        for i, ln in enumerate(text_lines):
            for lp in label_patterns:
                if re.search(lp, ln, flags=re.IGNORECASE):
                    if i + 1 < len(text_lines):
                        m = re.search(value_pattern, text_lines[i + 1], flags=re.IGNORECASE)
                        if m:
                            return _to_num(m.group(1))
        return None

    def _find_any(patterns: list[str]) -> float | None:
        for pattern in patterns:
            m = re.search(pattern, flat, flags=re.IGNORECASE)
            if m:
                return _to_num(m.group(1))
        return None

    calories = (
        _find_line_value([r"\benergy\b", r"\bcalories\b"], value_pattern=r"(\d{1,5}(?:\.\d+)?)")
        or _find_nextline_value([r"\benergy\b", r"\bcalories\b"], value_pattern=r"(\d{1,5}(?:\.\d+)?)")
        or _find_any(
            [
                r"(?:energy|calories)[^\d]{0,25}(\d{1,5}(?:\.\d+)?)\s*(?:kcal|cal)",
                r"(\d{1,5}(?:\.\d+)?)\s*(?:kcal|cal)",
            ]
        )
    )

    fat = (
        _find_line_value([r"total\s*fat", r"\bfat\b"])
        or _find_any([r"total\s*fat[^\d]*(\d+(?:\.\d+)?)\s*g", r"\bfat\b[^\d]*(\d+(?:\.\d+)?)\s*g"])
    )

    sugar_line = _find_line_value([r"total\s*sugar", r"total\s*sugars", r"\bsugar\b"])
    sugar_next = _find_nextline_value([r"total\s*sugar", r"total\s*sugars"], value_pattern=r"(\d+(?:\.\d+)?)")
    sugar_any = _find_any([r"total\s*sugars?[^\d]*(\d+(?:\.\d+)?)\s*g", r"\bsugar\b[^\d]*(\d+(?:\.\d+)?)\s*g"])
    sugar = _prefer_decimal(sugar_line, _prefer_decimal(sugar_next, sugar_any))

    sodium_mg = (
        _find_line_value([r"\bsodium\b"], value_pattern=r"(\d+(?:\.\d+)?)")
        or _find_any([r"\bsodium\b[^\d]*(\d+(?:\.\d+)?)\s*mg"])
    )
    # Convert sodium mg -> salt g (~ sodium*2.5 / 1000)
    salt = None
    if sodium_mg is not None:
        try:
            salt = round((float(sodium_mg) * 2.5) / 1000.0, 2)
        except Exception:
            salt = None

    protein = (
        _find_line_value([r"\bprotein\b"])
        or _find_any([r"\bprotein\b[^\d]*(\d+(?:\.\d+)?)\s*g"])
    )

    fiber = (
        _find_line_value([r"(?:fiber|fibre|dietary)"])
        or _find_any([r"(?:fiber|fibre|dietary)[^\d]*(\d+(?:\.\d+)?)\s*g"])
    )

    carbs = (
        _find_line_value([r"\bcarbohydrate\b", r"\bcarb\b", r"\bcarbs\b"])
        or _find_any(
            [
                r"\bcarbohydrate\b[^\d]*(\d+(?:\.\d+)?)\s*g",
                r"\bcarbs?\b[^\d]*(\d+(?:\.\d+)?)\s*g",
            ]
        )
    )

    confidence = "medium" if calories is not None else "low"

    return {
        "product_name": "",
        "calories": calories,
        "fat": fat,
        "sugar": sugar,
        "salt": salt,
        "protein": protein,
        "fiber": fiber,
        "carbs": carbs,
        "confidence": confidence,
        "raw_text": text,
    }


_EASYOCR_READER = None


def _get_easyocr_reader():
    global _EASYOCR_READER
    if _EASYOCR_READER is None:
        import easyocr

        _EASYOCR_READER = easyocr.Reader(["en"], gpu=False)
    return _EASYOCR_READER


@app.post("/ocr", tags=["tracking"])
def ocr_nutrition_label(
    req: OCRRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    img_b64 = (req.image_base64 or "").strip()
    if not img_b64:
        raise HTTPException(status_code=400, detail="image_base64 is required")

    if "," in img_b64 and "base64" in img_b64[:80].lower():
        img_b64 = img_b64.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(img_b64, validate=False)
    except Exception as e:
        raise HTTPException(status_code=400, detail="invalid base64") from e

    extracted_text = _ocr_extract_text(image_bytes)
    parsed = _parse_nutrition_from_text(extracted_text)
    parsed["raw_text"] = extracted_text
    return parsed


@app.post("/food-log", tags=["tracking"])
def log_food(
    req: FoodLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    product_name = (req.product_name or "").strip()
    if not product_name:
        raise HTTPException(status_code=400, detail="product_name is required")

    calories = float(req.calories or 0.0)
    db_service.log_food_consumption(
        db,
        barcode="manual",
        product_name=product_name,
        calories=calories,
        user_id=int(current_user.id),
    )
    db.commit()
    return {"status": "logged"}


@app.post("/analyze", tags=["tracking"])
def analyze(
    req: AnalyzeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    name = (req.product_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="product_name is required")

    product = {
        "barcode": "00000000",
        "product_name": name,
        "calories": req.calories,
        "fat": req.fat,
        "sugar": req.sugar,
        "salt": req.salt,
        "protein": req.protein,
        "fiber": req.fiber,
        "carbs": req.carbs,
        "ingredients": None,
        "additives": None,
    }

    product["ingredient_analysis"] = analyze_ingredients(product.get("ingredients"))
    product["additive_analysis"] = analyze_additives(product.get("additives"))

    health = compute_food_health_score(product)
    final = compute_final_decision(
        health,
        remaining_calories=float("inf"),
        product_calories=float(product.get("calories") or 0.0),
    )
    product["health_score"] = final.get("health_score")
    product["final_decision"] = final.get("final_decision")
    product["reasons"] = build_decision_reasons(product, remaining_calories=float("inf"))

    diet_note = final.get("diet_note")
    if diet_note is None and isinstance(health, dict):
        diet_note = health.get("diet_note")

    nutrition_per_100g = {
        "calories": product.get("calories"),
        "fat": product.get("fat"),
        "sugar": product.get("sugar"),
        "salt": product.get("salt"),
        "protein": product.get("protein"),
        "fiber": product.get("fiber"),
        "carbs": product.get("carbs"),
    }

    serving_size = req.serving_size
    if isinstance(serving_size, (int, float)):
        try:
            serving_size = float(serving_size)
        except Exception:
            serving_size = None
    if serving_size is not None and serving_size <= 0:
        serving_size = None

    nutrition_per_serving = None
    if serving_size is not None:
        ratio = float(serving_size) / 100.0

        def _scale(v: object) -> float | None:
            f = _to_float(v)
            if f is None:
                return None
            return round(f * ratio, 3)

        nutrition_per_serving = {
            "serving_size": float(serving_size),
            "calories": _scale(nutrition_per_100g.get("calories")),
            "fat": _scale(nutrition_per_100g.get("fat")),
            "sugar": _scale(nutrition_per_100g.get("sugar")),
            "salt": _scale(nutrition_per_100g.get("salt")),
            "protein": _scale(nutrition_per_100g.get("protein")),
            "fiber": _scale(nutrition_per_100g.get("fiber")),
            "carbs": _scale(nutrition_per_100g.get("carbs")),
        }

    return {
        "product": {
            "name": product.get("product_name"),
            "nutrition": nutrition_per_100g,
            "nutrition_per_100g": nutrition_per_100g,
            "nutrition_per_serving": nutrition_per_serving,
            "nutriscore": None,
        },
        "analysis": {
            "ingredient_analysis": product.get("ingredient_analysis"),
            "additive_analysis": product.get("additive_analysis"),
            "health_score": product.get("health_score"),
        },
        "decision": {
            "final_decision": product.get("final_decision"),
            "reasons": product.get("reasons"),
        },
        "diet_note": diet_note,
        "recommendations": [],
        "daily_intake": {
            "consumed": None,
            "remaining": None,
        },
    }


@app.on_event("startup")
def on_startup() -> None:
    orm_init_db()
    print("FoodScanner API running on http://127.0.0.1:8000")


@app.get("/health", tags=["tracking"])
def health() -> dict:
    return {"status": "running"}


@app.post("/register", tags=["auth"])
def register(req: RegisterRequest, db: Session = Depends(get_db)) -> dict:
    email = (req.email or "").strip().lower()
    password = req.password or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    existing = db.query(User).filter(User.email == email).first()
    if existing is not None:
        raise HTTPException(status_code=400, detail="email already registered")

    user = User(
        email=email,
        name=(req.name.strip() if isinstance(req.name, str) and req.name.strip() else None),
        hashed_password=hash_password(password),
        daily_calorie_limit=int(req.daily_calorie_limit or 2000),
        diet_type=None,
        created_at=db_service._utc_now_str(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user_id=int(user.id))
    return {"access_token": token, "token_type": "bearer"}


@app.post("/login", tags=["auth"])
def login(req: LoginRequest, db: Session = Depends(get_db)) -> dict:
    email = (req.email or "").strip().lower()
    password = req.password or ""
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    user = db.query(User).filter(User.email == email).first()
    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(user_id=int(user.id))
    return {"access_token": token, "token_type": "bearer"}


@app.get("/search", tags=["products"])
def search(
    query: str = Query(..., min_length=2, max_length=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return search_products(db, query)


@app.get("/product/{barcode}", tags=["products"])
def get_product(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    barcode = (barcode or "").strip()
    if not barcode.isdigit() or not (8 <= len(barcode) <= 14):
        raise HTTPException(status_code=400, detail="invalid barcode")

    product = db_service.get_product_by_barcode(db, barcode)
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")

    product["ingredient_analysis"] = analyze_ingredients(product.get("ingredients"))
    product["additive_analysis"] = analyze_additives(product.get("additives"))
    health = compute_food_health_score(product)
    final = compute_final_decision(
        health,
        remaining_calories=float("inf"),
        product_calories=float(product.get("calories") or 0.0),
    )
    product["health_score"] = final.get("health_score")
    product["final_decision"] = final.get("final_decision")
    product["reasons"] = build_decision_reasons(product, remaining_calories=float("inf"))

    analysis = {
        "ingredient_analysis": product.get("ingredient_analysis"),
        "additive_analysis": product.get("additive_analysis"),
        "health_score": product.get("health_score"),
    }
    decision = {
        "final_decision": product.get("final_decision"),
        "reasons": product.get("reasons"),
    }

    return {
        "product": {
            "name": product.get("product_name"),
            "nutrition": {
                "calories": product.get("calories"),
                "fat": product.get("fat"),
                "sugar": product.get("sugar"),
                "salt": product.get("salt"),
                "protein": product.get("protein"),
                "fiber": product.get("fiber"),
                "carbs": product.get("carbs"),
            },
            "nutriscore": product.get("nutriscore"),
        },
        "analysis": analysis,
        "decision": decision,
    }


@app.get("/today", tags=["tracking"])
def today(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    today_calories = db_service.get_today_calories(db, user_id=int(current_user.id))
    remaining_calories = db_service.get_remaining_calories(
        db,
        daily_limit=float(current_user.daily_calorie_limit or 2000),
        user_id=int(current_user.id),
    )

    start, end = db_service._local_day_bounds()
    today_foods = db.execute(
        select(FoodLog.product_name, FoodLog.calories, FoodLog.consumed_at).where(
            FoodLog.user_id == int(current_user.id),
            FoodLog.consumed_at >= start,
            FoodLog.consumed_at < end,
        )
    ).all()

    return {
        "calories_consumed_today": today_calories,
        "remaining_calories": remaining_calories,
        "foods": [
            {"product_name": r[0], "calories": float(r[1]) if r[1] is not None else None, "consumed_at": r[2]}
            for r in today_foods
        ],
    }


@app.post("/scan", tags=["tracking"])
def scan(
    req: ScanRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    barcode = req.barcode.strip()
    if not barcode:
        raise HTTPException(status_code=400, detail="barcode is required")

    result = lookup_product(
        db,
        barcode,
        product_name_hint=req.product_name,
        user_id=int(current_user.id),
        daily_calorie_limit=int(current_user.daily_calorie_limit or 2000),
        diet_type=current_user.diet_type,
    )
    if result is None:
        raise HTTPException(status_code=404, detail="product not found")

    nutrition = {
        "calories": result.get("calories"),
        "fat": result.get("fat"),
        "sugar": result.get("sugar"),
        "salt": result.get("salt"),
        "protein": result.get("protein"),
        "fiber": result.get("fiber"),
        "carbs": result.get("carbs"),
    }

    final_decision = str(result.get("final_decision") or "")
    if final_decision and final_decision.upper() != "SAFE":
        recommendations = get_healthier_alternatives(str(result.get("product_name") or ""), nutrition)
    else:
        recommendations = []

    return {
        "product": {
            "name": result.get("product_name"),
            "nutrition": nutrition,
            "nutriscore": result.get("nutriscore"),
        },
        "analysis": {
            "ingredient_analysis": result.get("ingredient_analysis"),
            "additive_analysis": result.get("additive_analysis"),
            "health_score": result.get("health_score"),
        },
        "decision": {
            "final_decision": result.get("final_decision"),
            "reasons": result.get("reasons"),
        },
        "diet_note": result.get("diet_note"),
        "recommendations": recommendations,
        "daily_intake": {
            "consumed": result.get("today_calories_consumed"),
            "remaining": result.get("remaining_calories"),
        },
    }


@app.post("/compare", tags=["products"])
def compare(req: CompareRequest, db: Session = Depends(get_db)) -> dict:
    a = db_service.get_product_by_name_fuzzy(db, req.product_a, min_similarity=80.0)
    if a is None:
        ds = _csv_fuzzy_lookup(req.product_a, threshold=75.0)
        if ds is None:
            raise HTTPException(status_code=404, detail="product_a not found")
        a = ds

    b = db_service.get_product_by_name_fuzzy(db, req.product_b, min_similarity=80.0)
    if b is None:
        ds = _csv_fuzzy_lookup(req.product_b, threshold=75.0)
        if ds is None:
            raise HTTPException(status_code=404, detail="product_b not found")
        b = ds

    a_nutrition = {
        "calories": _to_float(a.get("calories")),
        "sugar": _to_float(a.get("sugar")),
        "salt": _to_float(a.get("salt")),
        "fat": _to_float(a.get("fat")),
        "fiber": _to_float(a.get("fiber")),
        "protein": _to_float(a.get("protein")),
    }
    b_nutrition = {
        "calories": _to_float(b.get("calories")),
        "sugar": _to_float(b.get("sugar")),
        "salt": _to_float(b.get("salt")),
        "fat": _to_float(b.get("fat")),
        "fiber": _to_float(b.get("fiber")),
        "protein": _to_float(b.get("protein")),
    }

    a_score = 0
    b_score = 0
    reasons: list[str] = []

    if a_nutrition.get("sugar") is not None and b_nutrition.get("sugar") is not None:
        if b_nutrition["sugar"] < a_nutrition["sugar"]:
            b_score += 1
            pct = _pct_less(a_nutrition["sugar"], b_nutrition["sugar"])
            reasons.append(f"{pct}% less sugar" if pct is not None else "lower sugar")
        elif a_nutrition["sugar"] < b_nutrition["sugar"]:
            a_score += 1
            pct = _pct_less(b_nutrition["sugar"], a_nutrition["sugar"])
            reasons.append(f"{pct}% less sugar" if pct is not None else "lower sugar")

    if a_nutrition.get("salt") is not None and b_nutrition.get("salt") is not None:
        if b_nutrition["salt"] < a_nutrition["salt"]:
            b_score += 1
            pct = _pct_less(a_nutrition["salt"], b_nutrition["salt"])
            reasons.append(f"{pct}% less sodium" if pct is not None else "lower sodium")
        elif a_nutrition["salt"] < b_nutrition["salt"]:
            a_score += 1
            pct = _pct_less(b_nutrition["salt"], a_nutrition["salt"])
            reasons.append(f"{pct}% less sodium" if pct is not None else "lower sodium")

    if a_nutrition.get("fat") is not None and b_nutrition.get("fat") is not None:
        if b_nutrition["fat"] < a_nutrition["fat"]:
            b_score += 1
            pct = _pct_less(a_nutrition["fat"], b_nutrition["fat"])
            reasons.append(f"{pct}% less fat" if pct is not None else "lower fat")
        elif a_nutrition["fat"] < b_nutrition["fat"]:
            a_score += 1
            pct = _pct_less(b_nutrition["fat"], a_nutrition["fat"])
            reasons.append(f"{pct}% less fat" if pct is not None else "lower fat")

    if a_nutrition.get("fiber") is not None and b_nutrition.get("fiber") is not None:
        if b_nutrition["fiber"] > a_nutrition["fiber"]:
            b_score += 1
            pct = _pct_more(a_nutrition["fiber"], b_nutrition["fiber"])
            reasons.append(f"{pct}% more fiber" if pct is not None else "higher fiber")
        elif a_nutrition["fiber"] > b_nutrition["fiber"]:
            a_score += 1
            pct = _pct_more(b_nutrition["fiber"], a_nutrition["fiber"])
            reasons.append(f"{pct}% more fiber" if pct is not None else "higher fiber")

    if b_score > a_score:
        healthier = str(b.get("product_name") or "")
    elif a_score > b_score:
        healthier = str(a.get("product_name") or "")
    else:
        healthier = "TIE"
        reasons = []

    return {
        "product_a": {
            "name": a.get("product_name"),
            "nutrition": a_nutrition,
            "match": a.get("_match"),
        },
        "product_b": {
            "name": b.get("product_name"),
            "nutrition": b_nutrition,
            "match": b.get("_match"),
        },
        "healthier_product": healthier,
        "reasons": reasons,
    }


@app.get("/history", tags=["tracking"])
def history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[dict]:
    return db_service.get_recent_scans(db, user_id=int(current_user.id), limit=20)


@app.delete("/history/{scan_id}", tags=["tracking"])
def delete_history(
    scan_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    scan = (
        db.query(ScanHistory)
        .filter(
            ScanHistory.id == int(scan_id),
            ScanHistory.user_id == int(current_user.id),
        )
        .first()
    )
    if scan is None:
        raise HTTPException(status_code=404, detail="scan not found")

    db.delete(scan)
    db.commit()
    return {"deleted": True}


@app.get("/stats", tags=["tracking"])
def stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    counts = db_service.get_scan_counts(db, user_id=int(current_user.id))
    most = db_service.get_most_scanned_product(db, user_id=int(current_user.id))
    decisions = db_service.get_decision_counts(db, user_id=int(current_user.id))
    avg_score = db_service.get_average_health_score(db, user_id=int(current_user.id))

    return {
        "total_scans_ever": counts.get("total_scans", 0),
        "scans_this_week": counts.get("scans_this_week", 0),
        "most_scanned_product": most,
        "average_health_score": avg_score,
        "decision_counts": decisions,
    }


@app.get("/user/profile", tags=["user"])
def get_user_profile(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    profile = db_service.get_user_profile(db, user_id=int(current_user.id))
    if profile is None:
        raise HTTPException(status_code=404, detail="user not found")
    return profile


@app.put("/user/profile", tags=["user"])
def update_user_profile(
    req: UserProfileUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    diet_type = req.diet_type
    if isinstance(diet_type, str):
        diet_type = diet_type.strip().lower()
        if not diet_type:
            diet_type = None

    updated = db_service.update_user_profile(
        db,
        user_id=int(current_user.id),
        name=req.name,
        daily_calorie_limit=req.daily_calorie_limit,
        diet_type=diet_type,
        goal_type=req.goal_type,
        goal_target_days=req.goal_target_days,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="user not found")
    return updated


@app.get("/report/daily", tags=["tracking"])
def daily_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return generate_daily_report(db, current_user)


@app.get("/report/weekly", tags=["tracking"])
def weekly_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    week_logs = db_service.get_week_food_logs(db, int(current_user.id))
    daily_summaries = []
    for day_str, logs in week_logs.items():
        total_cal = sum(float(log.get("calories") or 0) for log in logs)
        total_products = len(logs)
        avoid_count = 0
        for log in logs:
            mock = {
                "calories": log["calories"],
                "sugar": log["sugar"],
                "salt": log["salt"],
                "fat": log["fat"],
                "saturated_fat": log.get("saturated_fat"),
                "protein": log["protein"],
                "fiber": log["fiber"],
                "ingredients": log["ingredients"],
                "additives": log["additives"],
            }
            result = compute_food_health_score(mock)
            if result.get("decision") == "AVOID":
                avoid_count += 1
        # Simple day score: 100 - 15*avoid_count - 5*MODERATE (not counted here)
        day_score = max(0, 100 - avoid_count * 15)
        daily_summaries.append(
            {
                "date": day_str,
                "total_calories": round(total_cal, 1),
                "total_products_scanned": total_products,
                "avoid_count": avoid_count,
                "day_score": day_score,
            }
        )
    # Week summary
    if not daily_summaries:
        return {"days": [], "week_summary": {"average_day_score": 0, "best_day": None, "worst_day": None, "trend": "STABLE"}}
    avg_score = sum(d["day_score"] for d in daily_summaries) / len(daily_summaries)
    best = max(daily_summaries, key=lambda d: d["day_score"])
    worst = min(daily_summaries, key=lambda d: d["day_score"])
    # Trend: compare first 3 vs last 3 days
    first_three = [d["day_score"] for d in daily_summaries[-3:]]
    last_three = [d["day_score"] for d in daily_summaries[:3]]
    if len(first_three) == 0 or len(last_three) == 0:
        trend = "STABLE"
    else:
        avg_first = sum(first_three) / len(first_three)
        avg_last = sum(last_three) / len(last_three)
        if avg_last > avg_first + 5:
            trend = "IMPROVING"
        elif avg_last < avg_first - 5:
            trend = "DECLINING"
        else:
            trend = "STABLE"
    return {
        "days": daily_summaries,
        "week_summary": {
            "average_day_score": round(avg_score, 1),
            "best_day": {"date": best["date"], "score": best["day_score"]},
            "worst_day": {"date": worst["date"], "score": worst["day_score"]},
            "trend": trend,
        },
    }


@app.get("/explain/{barcode}", tags=["products"])
def explain_product(
    barcode: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    product = db_service.get_product_by_barcode(db, barcode.strip())
    if product is None:
        raise HTTPException(status_code=404, detail="product not found")
    # Enrich with ingredient/additive analysis for explanation
    product["ingredient_analysis"] = analyze_ingredients(product.get("ingredients"))
    product["additive_analysis"] = analyze_additives(product.get("additives"))
    return explain_score(product, current_user.diet_type)


@app.get("/report/goal", tags=["tracking"])
def goal_report(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    return generate_goal_report(db, current_user)
