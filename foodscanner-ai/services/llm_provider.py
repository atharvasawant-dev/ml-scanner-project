from __future__ import annotations

from abc import ABC, abstractmethod
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional
import requests

logger = logging.getLogger(__name__)


class LLMProviderError(RuntimeError):
    """Base exception for LLM provider errors."""
    pass


class LLMConfigurationError(LLMProviderError):
    """Raised when LLM provider is misconfigured or lacks necessary credentials."""
    pass


class LLMUnavailableError(LLMProviderError):
    """Raised when the LLM service times out or cannot be reached."""
    pass


class BaseLLMProvider(ABC):
    """Abstract base class for AI LLM providers."""

    @abstractmethod
    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate a grounded response given system prompt and user prompt."""
        pass

    @abstractmethod
    def health_check(self) -> Dict[str, Any]:
        """Check if the provider is configured and available."""
        pass


class MockLLMProvider(BaseLLMProvider):
    """Deterministic, grounded mock LLM provider for offline testing and reliable presentation demos.

    Constructs realistic, high-quality, structured responses grounded entirely in
    the provided product facts, score factors, and retrieved knowledge sources.
    """

    def health_check(self) -> Dict[str, Any]:
        return {"status": "available", "provider": "mock", "model": "deterministic-mock-v1"}

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        data = context_data or {}
        query = str(data.get("query") or user_prompt).strip()
        query_lower = query.lower()

        product = data.get("product")
        user_profile = data.get("user_profile") or {}
        sources = data.get("sources") or []

        p_name = product.get("product_name") or product.get("name") if product else None
        p_score = product.get("health_score") if product else None
        p_decision = product.get("final_decision") if product else None
        nutr = (product.get("nutrition") or {}) if product else {}

        goal_type = (user_profile.get("goal_type") or "").lower()
        diet_type = (user_profile.get("diet_type") or "").lower()

        # Build structured response components
        sections: List[str] = []

        # Case 1: General question (No product context)
        if not product:
            if "sugar" in query_lower and "added" in query_lower:
                sections.append(
                    "Total sugar includes naturally occurring sugars (like lactose in milk or fructose in fruit) "
                    "plus added refined sugars. Added sugars contribute empty calories without vitamins or fiber, "
                    "whereas naturally occurring sugars come with water and micronutrients."
                )
                sections.append(
                    "\nWhy it matters:\n"
                    "• WHO guidelines recommend limiting free/added sugars to under 10% of daily calories (approx 50g), ideally under 25g.\n"
                    "• Added sugars rapidly elevate blood glucose and increase risks of dental caries and metabolic disorders."
                )
            elif "score" in query_lower or "pramaan" in query_lower:
                sections.append(
                    "PRAMAAN calculates an objective, deterministic 0–100 health score starting from a baseline of 100. "
                    "Penalties are deducted for high sugar, salt, saturated fat, excess calories, and risky additives, "
                    "while bonuses are awarded for dietary fiber and protein. Thresholds: SAFE (>= 70), MODERATE (45–69), AVOID (< 45)."
                )
            elif "protein" in query_lower:
                sections.append(
                    "According to ICMR-NIN 2020 guidelines, healthy Indian adults require approximately 0.83g of protein "
                    "per kg body weight (around 54g/day for a 65kg adult). Active individuals and those building muscle benefit from 1.2–2.0g/kg."
                )
            elif "weight loss" in query_lower or "lose weight" in query_lower:
                sections.append(
                    "For healthy weight management, prioritize foods with low caloric density (< 200 kcal/100g), "
                    "high dietary fiber (> 3g/100g), and lean protein (> 8g/100g) to maximize fullness while staying within your daily calorie limit."
                )
            else:
                sections.append(
                    "Nutrition guidelines emphasize balanced macronutrients, keeping free sugars under 10% of total energy, "
                    "salt under 5g per day, saturated fat under 10%, and dietary fibre at 25g to 30g daily."
                )

            if sources:
                src_names = [f"• {s.get('source')} ({s.get('title') or s.get('topic')})" for s in sources[:2]]
                sections.append("\nSources:\n" + "\n".join(src_names))
            return "\n".join(sections)

        # Case 2: Product-specific questions
        # Subcase 2A: Score explanation query
        if "why" in query_lower and ("score" in query_lower or "62" in query_lower or "get" in query_lower):
            score_str = f"{p_score}/100" if p_score is not None else "evaluated"
            dec_str = f" ({p_decision})" if p_decision else ""
            sections.append(f"PRAMAAN's official score for {p_name} is {score_str}{dec_str}.")

            why_bullets = []
            reasons = product.get("reasons") or []
            if reasons:
                for r in reasons[:3]:
                    why_bullets.append(f"• {r}")
            else:
                sugar_val = nutr.get("sugar")
                fat_val = nutr.get("fat")
                prot_val = nutr.get("protein")
                if sugar_val is not None and sugar_val > 15:
                    why_bullets.append(f"• High sugar content ({sugar_val}g/100g) resulted in a score deduction.")
                if fat_val is not None and fat_val > 20:
                    why_bullets.append(f"• High fat content ({fat_val}g/100g) affected the overall score.")
                if prot_val is not None and prot_val >= 8:
                    why_bullets.append(f"• Protein content ({prot_val}g/100g) contributed positive bonus points.")

            if not why_bullets:
                why_bullets.append("• Evaluated against FSSAI and WHO nutritional thresholds.")
            sections.append("\nWhy:\n" + "\n".join(why_bullets))

        # Subcase 2B: Alternative query
        elif "alternative" in query_lower or "healthier" in query_lower or "substitute" in query_lower:
            alts = product.get("recommendations") or []
            if alts:
                top_alt = alts[0]
                alt_name = top_alt.get("product_name", "Healthier alternative")
                alt_reason = top_alt.get("reason", "Better balanced nutritional profile")
                alt_score = top_alt.get("health_score")
                score_part = f" (Score: {alt_score}/100)" if alt_score else ""
                sections.append(f"A healthier alternative in this category is {alt_name}{score_part}.")
                sections.append(f"\nWhy:\n• {alt_reason}")
            else:
                sections.append(f"No significantly healthier packaged alternative was found for {p_name} in its category.")

        # Subcase 2C: Weight loss or general fitness fit
        elif "weight loss" in query_lower or "lose weight" in query_lower:
            cal_val = nutr.get("calories")
            sug_val = nutr.get("sugar")
            fib_val = nutr.get("fiber")

            cal_str = f"{cal_val} kcal/100g" if cal_val is not None else "Calorie data not available"
            is_high_cal = cal_val is not None and cal_val > 300
            is_high_sug = sug_val is not None and sug_val > 15

            if is_high_cal or is_high_sug:
                sections.append(f"{p_name} is not ideal for weight loss due to its high caloric density ({cal_str}).")
            else:
                sections.append(f"{p_name} can fit into a weight loss plan in moderation ({cal_str}).")

            why_bullets = []
            if cal_val is not None:
                why_bullets.append(f"• Provides {cal_val} kcal per 100g towards your daily calorie budget.")
            if sug_val is not None:
                why_bullets.append(f"• Sugar content is {sug_val}g/100g.")
            if fib_val is not None:
                why_bullets.append(f"• Dietary fibre is {fib_val}g/100g (higher fiber supports satiety).")
            sections.append("\nWhy:\n" + "\n".join(why_bullets))

        # Subcase 2D: Muscle building query
        elif "muscle" in query_lower or "protein" in query_lower:
            prot_val = nutr.get("protein")
            prot_str = f"{prot_val}g/100g" if prot_val is not None else "Protein value not available on label"
            if prot_val is not None and prot_val >= 10:
                sections.append(f"{p_name} provides a good amount of protein ({prot_str}) to support muscle synthesis.")
            else:
                sections.append(f"{p_name} is relatively low in protein ({prot_str}) for a dedicated muscle building target.")

            why_bullets = [f"• Declared protein: {prot_str}"]
            cal_val = nutr.get("calories")
            if cal_val is not None:
                why_bullets.append(f"• Energy: {cal_val} kcal/100g")
            sections.append("\nWhy:\n" + "\n".join(why_bullets))

        # Subcase 2E: General product evaluation
        else:
            score_disp = f"PRAMAAN Health Score is {p_score}/100 ({p_decision})" if p_score is not None else "Analyzed nutritional profile"
            sections.append(f"Here is the evaluation for {p_name}: {score_disp}.")

            why_bullets = []
            for k, label, unit in [
                ("calories", "Calories", "kcal"),
                ("protein", "Protein", "g"),
                ("sugar", "Sugar", "g"),
                ("fat", "Fat", "g"),
                ("salt", "Salt/Sodium", "g"),
                ("fiber", "Fibre", "g"),
            ]:
                v = nutr.get(k)
                if v is not None:
                    why_bullets.append(f"• {label}: {v} {unit}/100g")
                else:
                    why_bullets.append(f"• {label}: Not available on label")
            sections.append("\nWhy:\n" + "\n".join(why_bullets[:4]))

        # Section: For your goal / diet (if applicable)
        if goal_type:
            goal_clean = goal_type.replace('_', ' ')
            sections.append(f"\nFor your goal ({goal_clean}):\n• Keep portion sizes mindful to stay aligned with your daily nutrition targets.")
        if diet_type:
            diet_clean = diet_type.replace('_', ' ')
            diet_note = product.get("diet_note")
            if diet_note:
                sections.append(f"\nFor your diet ({diet_clean}):\n• {diet_note}")

        # Section: Sources
        if sources:
            src_lines = [f"• {s.get('source')} ({s.get('title') or s.get('topic')})" for s in sources[:2]]
            sections.append("\nSources:\n" + "\n".join(src_lines))

        return "\n".join(sections)


class GeminiProvider(BaseLLMProvider):
    """Google Gemini API Provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gemini-1.5-flash", timeout: float = 12.0):
        self.api_key = api_key or os.environ.get("AI_API_KEY")
        self.model = model or os.environ.get("AI_MODEL", "gemini-1.5-flash")
        self.timeout = timeout

    def health_check(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "provider": "gemini", "error": "AI_API_KEY is not set"}
        return {"status": "configured", "provider": "gemini", "model": self.model}

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        if not self.api_key:
            raise LLMConfigurationError("Gemini AI_API_KEY is missing")

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent?key={self.api_key}"
        payload = {
            "contents": [
                {"role": "user", "parts": [{"text": f"{system_prompt}\n\nUser Question:\n{user_prompt}"}]}
            ],
            "generationConfig": {
                "temperature": 0.2,
                "maxOutputTokens": 600,
            },
        }

        try:
            resp = requests.post(url, json=payload, timeout=self.timeout)
            if resp.status_code != 200:
                raise LLMProviderError(f"Gemini API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            candidates = data.get("candidates") or []
            if not candidates:
                raise LLMProviderError("Empty candidates returned from Gemini API")
            parts = candidates[0].get("content", {}).get("parts", [])
            if not parts:
                raise LLMProviderError("Malformed content in Gemini API response")
            return parts[0].get("text", "")
        except requests.exceptions.Timeout as exc:
            raise LLMUnavailableError(f"Gemini API timed out after {self.timeout}s") from exc
        except requests.exceptions.RequestException as exc:
            raise LLMUnavailableError(f"Gemini network request failed: {exc}") from exc


class OpenAIProvider(BaseLLMProvider):
    """OpenAI or OpenAI-compatible (Ollama/LocalAI) API Provider."""

    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4o-mini", base_url: str = "https://api.openai.com/v1", timeout: float = 12.0):
        self.api_key = api_key or os.environ.get("AI_API_KEY")
        self.model = model or os.environ.get("AI_MODEL", "gpt-4o-mini")
        self.base_url = os.environ.get("AI_BASE_URL", base_url).rstrip("/")
        self.timeout = timeout

    def health_check(self) -> Dict[str, Any]:
        if not self.api_key:
            return {"status": "unconfigured", "provider": "openai", "error": "AI_API_KEY is not set"}
        return {"status": "configured", "provider": "openai", "model": self.model}

    def generate(
        self,
        system_prompt: str,
        user_prompt: str,
        context_data: Optional[Dict[str, Any]] = None,
    ) -> str:
        if not self.api_key:
            raise LLMConfigurationError("OpenAI AI_API_KEY is missing")

        url = f"{self.base_url}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.2,
            "max_tokens": 600,
        }

        try:
            resp = requests.post(url, headers=headers, json=payload, timeout=self.timeout)
            if resp.status_code != 200:
                raise LLMProviderError(f"OpenAI API returned HTTP {resp.status_code}: {resp.text}")
            data = resp.json()
            choices = data.get("choices") or []
            if not choices:
                raise LLMProviderError("Empty choices returned from OpenAI API")
            msg = choices[0].get("message", {}).get("content", "")
            return msg
        except requests.exceptions.Timeout as exc:
            raise LLMUnavailableError(f"OpenAI API timed out after {self.timeout}s") from exc
        except requests.exceptions.RequestException as exc:
            raise LLMUnavailableError(f"OpenAI network request failed: {exc}") from exc


def get_llm_provider() -> BaseLLMProvider:
    """Factory function to instantiate the configured LLM provider."""
    provider_name = (os.environ.get("AI_PROVIDER") or "mock").strip().lower()
    api_key = os.environ.get("AI_API_KEY")
    model = os.environ.get("AI_MODEL")

    if provider_name == "gemini":
        if not api_key:
            logger.warning("AI_PROVIDER=gemini requested but AI_API_KEY is empty; falling back to MockLLMProvider for demo stability.")
            return MockLLMProvider()
        return GeminiProvider(api_key=api_key, model=model or "gemini-1.5-flash")

    elif provider_name in {"openai", "ollama"}:
        if not api_key and provider_name != "ollama":
            logger.warning("AI_PROVIDER=openai requested but AI_API_KEY is empty; falling back to MockLLMProvider.")
            return MockLLMProvider()
        return OpenAIProvider(api_key=api_key or "local-key", model=model or "gpt-4o-mini")

    # Default provider for offline testing and demos
    return MockLLMProvider()
