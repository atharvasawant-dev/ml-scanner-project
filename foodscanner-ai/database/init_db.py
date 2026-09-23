import sqlite3
import sys
from pathlib import Path

from sqlalchemy import inspect, text

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "foodscanner.db"
SCHEMA_PATH = BASE_DIR / "schema.sql"


def run_migrations(engine) -> None:
    """Run database migrations safely for both SQLite and PostgreSQL."""
    try:
        with engine.begin() as conn:
            inspector = inspect(conn)
            table_names = set(inspector.get_table_names())

            # Users table migrations
            if "users" in table_names:
                cols = {c["name"] for c in inspector.get_columns("users")}
                if "name" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN name VARCHAR(255)"))
                if "hashed_password" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN hashed_password VARCHAR(255) DEFAULT ''"))
                if "age" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN age INTEGER"))
                if "weight" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN weight FLOAT"))
                if "height" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN height FLOAT"))
                if "goal_type" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN goal_type VARCHAR(100)"))
                if "goal_target_days" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN goal_target_days INTEGER DEFAULT 30"))
                if "goal_started_at" not in cols:
                    conn.execute(text("ALTER TABLE users ADD COLUMN goal_started_at VARCHAR(100)"))

            # Products table migrations
            if "products" in table_names:
                p_cols = {c["name"] for c in inspector.get_columns("products")}
                if "brand" not in p_cols:
                    conn.execute(text("ALTER TABLE products ADD COLUMN brand VARCHAR(255)"))
                if "ingredients" not in p_cols:
                    conn.execute(text("ALTER TABLE products ADD COLUMN ingredients TEXT"))
                if "additives" not in p_cols:
                    conn.execute(text("ALTER TABLE products ADD COLUMN additives TEXT"))

            # Scan history migrations
            if "scan_history" in table_names:
                s_cols = {c["name"] for c in inspector.get_columns("scan_history")}
                if "user_id" not in s_cols:
                    conn.execute(text("ALTER TABLE scan_history ADD COLUMN user_id INTEGER DEFAULT 1"))

            # Daily food log migrations
            if "daily_food_log" in table_names:
                log_cols = {c["name"] for c in inspector.get_columns("daily_food_log")}
                if "user_id" not in log_cols:
                    conn.execute(text("ALTER TABLE daily_food_log ADD COLUMN user_id INTEGER DEFAULT 1"))
                for macro_col in ("fat", "sugar", "salt", "protein", "fiber", "carbs"):
                    if macro_col not in log_cols:
                        conn.execute(text(f"ALTER TABLE daily_food_log ADD COLUMN {macro_col} FLOAT"))
    except Exception as e:
        print(f"Migration failed: {e}")
        raise


def _ensure_default_user(conn: sqlite3.Connection) -> None:
    row = conn.execute("SELECT id FROM users WHERE id = 1").fetchone()
    if row is None:
        conn.execute(
            """
            INSERT INTO users (id, name, email, hashed_password, daily_calorie_limit, diet_type, created_at)
            VALUES (1, 'Default User', 'default@local', '', 2000, NULL, datetime('now'))
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
        _ensure_default_user(conn)
        conn.commit()
    finally:
        conn.close()

    from database.orm import engine
    run_migrations(engine)
    print(f"Initialized/migrated database at: {db_path}")


if __name__ == "__main__":
    init_db()
