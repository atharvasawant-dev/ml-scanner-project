from __future__ import annotations

import sqlite3
from pathlib import Path

from sqlalchemy import inspect, text


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "foodscanner.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def _ensure_products_columns(conn: sqlite3.Connection) -> None:
    rows = conn.execute("PRAGMA table_info(products)").fetchall()
    existing = {r[1] for r in rows}

    if "ingredients" not in existing:
        conn.execute("ALTER TABLE products ADD COLUMN ingredients TEXT")

    if "additives" not in existing:
        conn.execute("ALTER TABLE products ADD COLUMN additives TEXT")


def _ensure_users_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            daily_calorie_limit INTEGER NOT NULL DEFAULT 2000,
            diet_type TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        """
    )


def _ensure_user_id_columns(conn: sqlite3.Connection) -> None:
    scan_cols = {r[1] for r in conn.execute("PRAGMA table_info(scan_history)").fetchall()}
    if "user_id" not in scan_cols:
        conn.execute("ALTER TABLE scan_history ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")

    log_cols = {r[1] for r in conn.execute("PRAGMA table_info(daily_food_log)").fetchall()}
    if "user_id" not in log_cols:
        conn.execute("ALTER TABLE daily_food_log ADD COLUMN user_id INTEGER NOT NULL DEFAULT 1")


def _ensure_users_goal_columns(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(users)").fetchall()}
    if "goal_type" not in cols:
        try:
            conn.execute("ALTER TABLE users ADD COLUMN goal_type VARCHAR")
        except sqlite3.OperationalError:
            pass
    if "goal_target_days" not in cols:
        try:
            conn.execute("ALTER TABLE users ADD COLUMN goal_target_days INTEGER DEFAULT 30")
        except sqlite3.OperationalError:
            pass
    if "goal_started_at" not in cols:
        try:
            conn.execute("ALTER TABLE users ADD COLUMN goal_started_at VARCHAR")
        except sqlite3.OperationalError:
            pass


def run_migrations(engine) -> None:
    """Run database migrations safely."""
    try:
        with engine.begin() as conn:
            inspector = inspect(conn)
            table_names = set(inspector.get_table_names())
            if "users" not in table_names:
                return

            cols = {c["name"] for c in inspector.get_columns("users")}
            if "goal_type" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN goal_type VARCHAR"))
            if "goal_target_days" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN goal_target_days INTEGER DEFAULT 30"))
            if "goal_started_at" not in cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN goal_started_at VARCHAR"))
    except Exception as e:
        print(f"Migration failed: {e}")
        raise


def _ensure_default_user(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT id FROM users WHERE id = 1").fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO users (id, email, daily_calorie_limit, diet_type)
            VALUES (1, 'default@local', 2000, NULL)
            """
        )


def init_db(db_path: Path = DB_PATH, schema_path: Path = SCHEMA_PATH) -> None:
    if not schema_path.exists():
        raise FileNotFoundError(f"schema.sql not found: {schema_path}")

    schema_sql = schema_path.read_text(encoding="utf-8")

    conn = sqlite3.connect(db_path)
    try:
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.executescript(schema_sql)
        _ensure_products_columns(conn)
        _ensure_users_table(conn)
        _ensure_user_id_columns(conn)
        _ensure_users_goal_columns(conn)
        _ensure_default_user(conn)
        conn.commit()
    finally:
        conn.close()

    print(f"Initialized/migrated database at: {db_path}")


if __name__ == "__main__":
    init_db()
