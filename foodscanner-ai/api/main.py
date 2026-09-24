from __future__ import annotations

from pathlib import Path
import base64
import io
import json
import logging
import hashlib
import os
import random
import re
import time
from typing import Any
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
from services.claim_verification import verify_claims
from services.ocr_service import process_image_ocr, parse_structured_ocr, run_ocr_engine

import pandas as pd
from rapidfuzz import fuzz


def _get_allowed_origins() -> list[str]:
    raw = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS") or ""
    configured = [o.strip() for o in raw.split(",") if o.strip()]
    defaults = [
        "http://localhost:8081",
        "http://localhost:19006",
        "http://localhost:3000",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:19006",
        "http://127.0.0.1:3000",
    ]
    origins = []
    for origin in defaults + configured:
        if origin not in origins and origin != "*":
            origins.append(origin)
    return origins


app = FastAPI(title="FoodScanner AI API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ScanRequest(BaseModel):
    barcode: str = Field(..., pattern=r"^\d{8,14}$")
    product_name: str | None = None
    claims: list[str] | None = None


class VerifyClaimsRequest(BaseModel):
    claims: list[str] = Field(..., description="List of health or nutritional claims to verify")
    nutrition: dict[str, Any] | None = None
    ingredients: Any | None = None
    barcode: str | None = None
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
    claims: list[str] | None = None


class FoodLogRequest(BaseModel):
    product_name: str
    barcode: str | None = None
    calories: float = 0
    fat: float | None = None
    sugar: float | None = None
    salt: float | None = None
    protein: float | None = None
    fiber: float | None = None
    carbs: float | None = None
    serving_size: float | None = None


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
    age: int | None = None
    weight: float | None = None
    height: float | None = None
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
    text, _ = run_ocr_engine(image_bytes)
    return text


def _parse_nutrition_from_text(text: str) -> dict:
    return parse_structured_ocr(text)


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

    if not image_bytes:
        raise HTTPException(status_code=400, detail="empty image payload")

    result = process_image_ocr(image_bytes)

    # Optional Batch 5 Claim Verification integration if claims are passed
    if req.claims:
        eff_nutrition = {
            "calories": result.get("calories"),
            "fat": result.get("fat"),
            "sugar": result.get("sugar"),
            "salt": result.get("salt"),
            "protein": result.get("protein"),
            "fiber": result.get("fiber"),
            "carbs": result.get("carbs"),
        }
        ing_raw = ""
        if isinstance(result.get("ingredients"), dict):
            ing_raw = result["ingredients"].get("raw_text") or ""
        result["claim_verification"] = verify_claims(
            claims=req.claims,
            nutrition=eff_nutrition,
            ingredients=ing_raw,
        )

    return result


@app.post("/food-log", tags=["tracking"])
def log_food(
    req: FoodLogRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    product_name = (req.product_name or "").strip()
    if not product_name:
        raise HTTPException(status_code=400, detail="product_name is required")

    # Scale nutrition values by serving size if provided (OCR returns per 100g values)
    scale_factor = 1.0
    if req.serving_size and req.serving_size > 0:
        scale_factor = req.serving_size / 100.0

    calories = float(req.calories or 0.0) * scale_factor
    fat = (float(req.fat) * scale_factor) if req.fat else None
    sugar = (float(req.sugar) * scale_factor) if req.sugar else None
    salt = (float(req.salt) * scale_factor) if req.salt else None
    protein = (float(req.protein) * scale_factor) if req.protein else None
    fiber = (float(req.fiber) * scale_factor) if req.fiber else None
    carbs = (float(req.carbs) * scale_factor) if req.carbs else None

    db_service.log_food_consumption(
        db,
        barcode=(req.barcode or "manual"),
        product_name=product_name,
        calories=calories,
        fat=fat,
        sugar=sugar,
        salt=salt,
        protein=protein,
        fiber=fiber,
        carbs=carbs,
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
    print("FoodScanner API running. For Expo Go, start uvicorn with --host 0.0.0.0 and open http://<your-lan-ip>:8000/health")


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

    try:
        result = lookup_product(
            db,
            barcode,
            product_name_hint=req.product_name,
            user_id=int(current_user.id),
            daily_calorie_limit=int(current_user.daily_calorie_limit or 2000),
            diet_type=current_user.diet_type,
        )
    except Exception as e:
        logging.error(f"Scan error for barcode {barcode}: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Scan error: {str(e)}")
    
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

    scan_response = {
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
    if req.claims:
        scan_response["claim_verification"] = verify_claims(
            claims=req.claims,
            nutrition=nutrition,
            ingredients=result.get("ingredients"),
        )
    return scan_response


@app.post("/verify-claims", tags=["claims"])
def verify_claims_endpoint(
    req: VerifyClaimsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
    if not isinstance(req.claims, list):
        raise HTTPException(status_code=400, detail="claims must be a list of strings")

    nutrition = dict(req.nutrition) if isinstance(req.nutrition, dict) else {}
    ingredients = req.ingredients

    # If barcode provided and nutrition or ingredients are missing, enrich from DB
    if req.barcode:
        bcode = str(req.barcode).strip()
        if bcode:
            product = db_service.get_product_by_barcode(db, bcode)
            if product:
                db_nutrition = {
                    "calories": product.get("calories"),
                    "fat": product.get("fat"),
                    "sugar": product.get("sugar"),
                    "salt": product.get("salt"),
                    "protein": product.get("protein"),
                    "fiber": product.get("fiber"),
                    "carbs": product.get("carbs"),
                }
                for k, v in db_nutrition.items():
                    if k not in nutrition and v is not None:
                        nutrition[k] = v
                if ingredients is None:
                    ingredients = product.get("ingredients")

    return verify_claims(claims=req.claims, nutrition=nutrition, ingredients=ingredients)


@app.post("/compare", tags=["products"])
def compare(
    req: CompareRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict:
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
        age=req.age,
        weight=req.weight,
        height=req.height,
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
