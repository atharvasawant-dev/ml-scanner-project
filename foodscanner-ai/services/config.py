from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, Optional
import logging
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

# Base paths
AI_DIR = Path(__file__).resolve().parents[1]
ROOT_DIR = AI_DIR.parent


def find_env_file() -> Optional[Path]:
    """Locate .env file across standard project locations."""
    candidates = [
        AI_DIR / ".env",
        ROOT_DIR / ".env",
        Path.cwd() / ".env",
        Path.cwd() / "foodscanner-ai" / ".env",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()
    return None


def load_environment(dotenv_path: Optional[Path | str] = None, override: bool = False) -> Optional[Path]:
    """Load environment variables from .env file without overriding existing env vars."""
    target_path = Path(dotenv_path) if dotenv_path else find_env_file()
    if target_path and target_path.exists():
        load_dotenv(dotenv_path=target_path, override=override)
        logger.info("Loaded environment from: %s", target_path)
        return target_path
    return None


def get_secret_key() -> str:
    """Retrieve the configured SECRET_KEY.
    
    Raises RuntimeError if SECRET_KEY is not configured.
    """
    secret = os.environ.get("SECRET_KEY")
    if not secret:
        # Check if insecure dev auth is explicitly opted into
        allow_insecure = str(os.environ.get("ALLOW_INSECURE_DEV_AUTH") or "").strip().lower() in {"1", "true", "yes"}
        if allow_insecure:
            return "dev-insecure-secret-key"
        raise RuntimeError(
            "SECRET_KEY is not configured. Create foodscanner-ai/.env from .env.example and set SECRET_KEY."
        )
    return secret


def validate_runtime_config(raise_error: bool = True) -> Dict[str, Any]:
    """Validate critical runtime configuration at startup.
    
    Ensures SECRET_KEY is set and environment is ready.
    Returns a dictionary of validated configuration with redacted secrets.
    """
    # Attempt to load .env if SECRET_KEY is not yet in environment
    if not os.environ.get("SECRET_KEY"):
        load_environment()

    errors = []
    secret = os.environ.get("SECRET_KEY")
    allow_insecure = str(os.environ.get("ALLOW_INSECURE_DEV_AUTH") or "").strip().lower() in {"1", "true", "yes"}

    if not secret and not allow_insecure:
        errors.append(
            "SECRET_KEY is not configured. Create foodscanner-ai/.env from .env.example and set SECRET_KEY."
        )

    if errors and raise_error:
        error_msg = "\n".join(errors)
        logger.critical("Runtime configuration failure:\n%s", error_msg)
        raise RuntimeError(error_msg)

    database_url = os.environ.get("DATABASE_URL") or "sqlite:///database/foodscanner.db (default)"
    ai_provider = os.environ.get("AI_PROVIDER") or "mock (default)"
    ai_model = os.environ.get("AI_MODEL") or "gemini-1.5-flash (default)"

    return {
        "valid": len(errors) == 0,
        "errors": errors,
        "secret_key_set": bool(secret or allow_insecure),
        "database_url": database_url,
        "ai_provider": ai_provider,
        "ai_model": ai_model,
    }
