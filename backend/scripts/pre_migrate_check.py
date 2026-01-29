"""Pre-migration safety check.

Run this before `alembic upgrade head` in production to detect
if the database already has data that could be affected.

Usage:
    python scripts/pre_migrate_check.py

Exit codes:
    0 - Safe to migrate (empty DB or alembic_version matches)
    1 - WARNING: Database has existing data — review before migrating
"""
import os
import sys

from sqlalchemy import create_engine, text, inspect

DATABASE_URL = os.getenv(
    "SYNC_DATABASE_URL",
    "postgresql://usageflow:usageflow_dev@localhost:5432/usageflow",
)

CORE_TABLES = [
    "tenants",
    "users",
    "end_customers",
    "api_keys",
    "usage_events",
]


def main():
    engine = create_engine(DATABASE_URL)
    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if not existing_tables:
        print("[OK] Database has no tables — safe to run migrations from scratch.")
        return 0

    print(f"[INFO] Found {len(existing_tables)} existing tables: {', '.join(sorted(existing_tables))}")

    # Check alembic version
    if "alembic_version" in existing_tables:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT version_num FROM alembic_version"))
            row = result.fetchone()
            if row:
                print(f"[INFO] Current alembic version: {row[0]}")
            else:
                print("[WARNING] alembic_version table exists but is empty!")

    # Check row counts for core tables
    has_data = False
    with engine.connect() as conn:
        for table in CORE_TABLES:
            if table in existing_tables:
                result = conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
                count = result.scalar()
                if count > 0:
                    has_data = True
                    print(f"[DATA] {table}: {count} rows")
                else:
                    print(f"[EMPTY] {table}: 0 rows")

    if has_data:
        print()
        print("=" * 60)
        print("WARNING: Database contains existing data!")
        print("Before running migrations, ensure you have:")
        print("  1. An RDS automated backup (check AWS Console)")
        print("  2. Verified the migration will not drop/recreate tables")
        print("  3. Tested the migration on a staging database first")
        print("=" * 60)
        return 1

    print("[OK] Core tables exist but are empty — safe to migrate.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
