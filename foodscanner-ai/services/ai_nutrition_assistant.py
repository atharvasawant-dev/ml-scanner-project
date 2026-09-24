from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session

from services import db_service
from services.barcode_lookup import lookup_product
from services.food_health_score import compute_food_health_score, compute_diet_aware_score
from services.final_decision_engine import compute_final_decision
from services.decision_explainer import build_decision_reasons
from services.score_explainer import explain_score
from services.recommendation_engine import get_healthier_alternatives
from services.rag_service import retrieve_relevant_knowledge
from services.llm_provider import get_llm_provider, LLMProviderError

logger = logging.getLogger(__name__)


def _to_float(value: Any) -> Optional[float]:
    try:
        if value is None:
            return None
        if isinstance(value, str) and not value.strip():
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def resolve_product_context(
    db: Optional[Session] = None,
    barcode: Optional[str] = None,
    product_context: Optional[Dict[str, Any]] = None,
    user: Any = None,
) -> Optional[Dict[str, Any]]:
    """Retrieve or normalize actual product facts without hallucination."""
    diet_type = getattr(user, "diet_type", None) if user else None
    daily_limit = float(getattr(user, "daily_calorie_limit", None) or 2000) if user else 2000.0

    # 1. Barcode lookup takes precedence (requires db)
    if barcode and db is not None:
        bcode = str(barcode).strip()
        if bcode:
            prod = db_service.get_product_by_barcode(db, bcode)
            if prod is None:
                try:
                    user_id = int(getattr(user, "id", 1) or 1)
                    prod = lookup_product(
                        db,
                        bcode,
                        user_id=user_id,
                        daily_calorie_limit=int(daily_limit),
                        diet_type=diet_type,
                    )
                except Exception as exc:
                    logger.warning("Barcode lookup error for %s: %s", bcode, exc)
                    prod = None

            if prod is not None:
                nutr = {
                    "calories": _to_float(prod.get("calories")),
                    "fat": _to_float(prod.get("fat")),
                    "saturated_fat": _to_float(prod.get("saturated_fat")),
                    "carbs": _to_float(prod.get("carbs")),
                    "sugar": _to_float(prod.get("sugar")),
                    "protein": _to_float(prod.get("protein")),
                    "fiber": _to_float(prod.get("fiber")),
                    "salt": _to_float(prod.get("salt")),
                }

                # Deterministic scoring
                if diet_type:
                    health = compute_diet_aware_score(prod, diet_type)
                else:
                    health = compute_food_health_score(prod)

                final_dec = health.get("decision")
                reasons = [health.get("reason")] if health.get("reason") else []

                # Healthier alternatives if not safe
                alts = []
                if final_dec != "SAFE":
                    p_name = str(prod.get("product_name") or "")
                    alts = get_healthier_alternatives(p_name, nutr, limit=2)

                return {
                    "name": prod.get("product_name"),
                    "product_name": prod.get("product_name"),
                    "brand": prod.get("brand"),
                    "barcode": prod.get("barcode") or bcode,
                    "nutriscore": prod.get("nutriscore"),
                    "nutrition": nutr,
                    "ingredients": prod.get("ingredients"),
                    "additives": prod.get("additives"),
                    "health_score": health.get("health_score"),
                    "final_decision": final_dec,
                    "reasons": reasons,
                    "diet_note": health.get("diet_note"),
                    "recommendations": alts,
                }

    # 2. Client supplied product_context fallback
    if isinstance(product_context, dict) and product_context:
        p_name = product_context.get("name") or product_context.get("product_name") or "Product"
        raw_nutr = product_context.get("nutrition") or product_context
        nutr = {
            "calories": _to_float(raw_nutr.get("calories")),
            "fat": _to_float(raw_nutr.get("fat")),
            "saturated_fat": _to_float(raw_nutr.get("saturated_fat")),
            "carbs": _to_float(raw_nutr.get("carbs")),
            "sugar": _to_float(raw_nutr.get("sugar")),
            "protein": _to_float(raw_nutr.get("protein")),
            "fiber": _to_float(raw_nutr.get("fiber")),
            "salt": _to_float(raw_nutr.get("salt")),
        }

        # Deterministic scoring
        mock_p = {"product_name": p_name, **nutr, "ingredients": product_context.get("ingredients")}
        if diet_type:
            health = compute_diet_aware_score(mock_p, diet_type)
        else:
            health = compute_food_health_score(mock_p)

        final_dec = health.get("decision")
        reasons = [health.get("reason")] if health.get("reason") else []

        alts = []
        if final_dec != "SAFE":
            alts = get_healthier_alternatives(p_name, nutr, limit=2)

        return {
            "name": p_name,
            "product_name": p_name,
            "brand": product_context.get("brand"),
            "barcode": product_context.get("barcode"),
            "nutriscore": product_context.get("nutriscore"),
            "nutrition": nutr,
            "ingredients": product_context.get("ingredients"),
            "additives": product_context.get("additives"),
            "health_score": health.get("health_score"),
            "final_decision": final_dec,
            "reasons": reasons,
            "diet_note": health.get("diet_note"),
            "recommendations": alts,
        }

    return None


def resolve_user_profile(user: Any) -> Dict[str, Any]:
    """Extract authenticated user profile safely."""
    if not user:
        return {}
    return {
        "email": getattr(user, "email", None),
        "name": getattr(user, "name", None),
        "diet_type": getattr(user, "diet_type", None),
        "goal_type": getattr(user, "goal_type", None),
        "daily_calorie_limit": getattr(user, "daily_calorie_limit", 2000),
        "age": getattr(user, "age", None),
        "weight": getattr(user, "weight", None),
        "height": getattr(user, "height", None),
    }


def build_system_prompt() -> str:
    """Build controlled system prompt adhering strictly to PRAMAAN safety rules."""
    return (
        "You are the PRAMAAN AI Nutrition Assistant, an expert, factual, and helpful food and nutrition guide.\n"
        "STRICT SAFETY & BEHAVIORAL RULES:\n"
        "1. DO NOT calculate or invent a new numerical health score. The PRAMAAN Health Score is computed deterministically "
        "by the backend engine. You may only explain the existing score provided in the context.\n"
        "2. Ground your answers strictly in the supplied product facts and retrieved knowledge base sources.\n"
        "3. Never fabricate nutritional values or ingredient information. If a nutrient or ingredient is not listed, explicitly state that it is not available on the label.\n"
        "4. Clearly distinguish verified product facts from general nutritional recommendations.\n"
        "5. Do NOT make medical diagnoses or claim foods cure or treat diseases.\n"
        "6. Provide concise, structured, user-friendly responses. Use bullet points where appropriate.\n"
        "7. Cite retrieved sources accurately when making source-based claims.\n"
    )


def build_user_prompt(
    query: str,
    product: Optional[Dict[str, Any]],
    user_profile: Dict[str, Any],
    retrieved_sources: List[Dict[str, Any]],
) -> str:
    """Format user query with retrieved knowledge, product facts, and profile context."""
    lines = [f"User Question: {query}\n"]

    if retrieved_sources:
        lines.append("=== RETRIEVED KNOWLEDGE SOURCES ===")
        for s in retrieved_sources:
            lines.append(f"[{s['id']}] {s['source']} ({s['topic']}): {s['text']}")
        lines.append("")

    if product:
        lines.append("=== VERIFIED PRODUCT DATA ===")
        lines.append(f"Product Name: {product.get('name')}")
        if product.get("brand"):
            lines.append(f"Brand: {product.get('brand')}")
        if product.get("barcode"):
            lines.append(f"Barcode: {product.get('barcode')}")
        lines.append(f"Official PRAMAAN Health Score: {product.get('health_score')}/100 ({product.get('final_decision')})")

        nutr = product.get("nutrition") or {}
        nutr_parts = []
        for k, label, unit in [
            ("calories", "Calories", "kcal"),
            ("sugar", "Sugar", "g"),
            ("fat", "Fat", "g"),
            ("saturated_fat", "Saturated Fat", "g"),
            ("protein", "Protein", "g"),
            ("fiber", "Fiber", "g"),
            ("salt", "Salt/Sodium", "g"),
            ("carbs", "Carbs", "g"),
        ]:
            val = nutr.get(k)
            nutr_parts.append(f"{label}: {val} {unit}" if val is not None else f"{label}: Not available on label")
        lines.append("Nutrition per 100g: " + ", ".join(nutr_parts))

        if product.get("ingredients"):
            lines.append(f"Ingredients: {product.get('ingredients')}")
        if product.get("additives"):
            lines.append(f"Additives: {product.get('additives')}")
        if product.get("reasons"):
            lines.append(f"Score Reasons: {', '.join(product.get('reasons'))}")
        if product.get("diet_note"):
            lines.append(f"Diet Note: {product.get('diet_note')}")
        if product.get("recommendations"):
            alt_names = [f"{a.get('product_name')} ({a.get('reason')})" for a in product.get("recommendations")[:2]]
            lines.append(f"Healthier Alternatives: {', '.join(alt_names)}")
        lines.append("")

    if user_profile and (user_profile.get("goal_type") or user_profile.get("diet_type")):
        lines.append("=== USER PROFILE CONTEXT ===")
        if user_profile.get("goal_type"):
            lines.append(f"User Goal: {user_profile.get('goal_type')}")
        if user_profile.get("diet_type"):
            lines.append(f"Diet Type: {user_profile.get('diet_type')}")
        if user_profile.get("daily_calorie_limit"):
            lines.append(f"Daily Calorie Budget: {user_profile.get('daily_calorie_limit')} kcal")
        lines.append("")

    return "\n".join(lines)


def ask_nutrition_assistant(
    query: str,
    barcode: Optional[str] = None,
    product_context: Optional[Dict[str, Any]] = None,
    user: Any = None,
    db: Optional[Session] = None,
) -> Dict[str, Any]:
    """Execute complete end-to-end RAG pipeline for the AI Nutrition Assistant.

    1. Validates query.
    2. Resolves actual backend product facts if barcode or context provided.
    3. Retrieves grounded knowledge from local knowledge base.
    4. Gathers user profile preferences if available.
    5. Builds prompt and generates structured answer via configured LLM provider.
    6. Ensures strict Scan != Eat safety (zero writes to FoodLog).
    """
    clean_query = (query or "").strip()
    if not clean_query:
        raise ValueError("User message cannot be empty")

    # 1. Resolve product context if available
    product = resolve_product_context(db=db, barcode=barcode, product_context=product_context, user=user)

    # 2. Resolve user profile
    profile = resolve_user_profile(user)

    # 3. Retrieve relevant knowledge chunks
    retrieved_sources = retrieve_relevant_knowledge(clean_query, top_k=3)

    # 4. Build prompt
    system_prompt = build_system_prompt()
    user_prompt = build_user_prompt(clean_query, product, profile, retrieved_sources)

    # 5. Generate response using LLM provider
    provider = get_llm_provider()
    context_data = {
        "query": clean_query,
        "product": product,
        "user_profile": profile,
        "sources": retrieved_sources,
    }

    try:
        raw_answer = provider.generate(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            context_data=context_data,
        )
    except LLMProviderError as exc:
        logger.error("LLM Provider failure: %s", exc)
        raw_answer = (
            "The AI assistant is temporarily unavailable. PRAMAAN's deterministic "
            "health scoring, claim verification, and product intelligence continue to operate normally."
        )

    # 6. Format source items for frontend response contract
    formatted_sources = [
        {
            "id": s["id"],
            "title": s["topic"],
            "source": s["source"],
            "type": s["source_type"],
            "version_or_date": s.get("version_or_date") or None,
        }
        for s in retrieved_sources
    ]

    return {
        "answer": raw_answer,
        "sources": formatted_sources,
        "product_context_used": product is not None,
        "profile_context_used": bool(profile.get("goal_type") or profile.get("diet_type")),
        "retrieved_context_count": len(retrieved_sources),
        "product_name": product.get("name") if product else None,
        "health_score": product.get("health_score") if product else None,
        "final_decision": product.get("final_decision") if product else None,
    }
