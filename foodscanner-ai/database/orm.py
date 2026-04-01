from __future__ import annotations

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv


load_dotenv()


DEFAULT_DATABASE_URL = "sqlite:///database/foodscanner.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def init_db() -> None:
    # Import models so they are registered with SQLAlchemy before create_all.
    from database import models  # noqa: F401
    from database.init_db import run_migrations

    Base.metadata.create_all(bind=engine)
    run_migrations(engine)
