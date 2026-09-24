from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[1]
DB_DIR = Path(__file__).resolve().parent
DEFAULT_DB_FILE = DB_DIR / "foodscanner.db"

# Load .env from current working directory and/or foodscanner-ai directory
load_dotenv()
env_file = BASE_DIR / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)


def resolve_database_url(url: Optional[str] = None) -> str:
    raw = (url or os.getenv("DATABASE_URL") or "").strip()
    if not raw:
        return f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
    if raw.startswith("sqlite:///") and not raw.startswith("sqlite:///:memory:"):
        path_str = raw[len("sqlite:///"):]
        p = Path(path_str)
        if not p.is_absolute():
            cwd_path = Path.cwd() / p
            if cwd_path.parent.exists() and (cwd_path.exists() or Path.cwd() == BASE_DIR):
                return f"sqlite:///{cwd_path.resolve().as_posix()}"
            resolved = (BASE_DIR / p).resolve()
            if resolved.parent.exists():
                return f"sqlite:///{resolved.as_posix()}"
            return f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
    return raw


DEFAULT_DATABASE_URL = f"sqlite:///{DEFAULT_DB_FILE.as_posix()}"
DATABASE_URL = resolve_database_url()

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    # Import models so they are registered with SQLAlchemy before create_all.
    from database import models  # noqa: F401
    from database.init_db import run_migrations

    Base.metadata.create_all(bind=engine)
    run_migrations(engine)

