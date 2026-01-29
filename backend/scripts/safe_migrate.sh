#!/usr/bin/env bash
# =============================================================================
# Safe Migration Script for TokenTrail
# =============================================================================
#
# Performs database migration with safety checks and automatic backup.
#
# Usage (inside API container):
#   bash scripts/safe_migrate.sh
#
# Usage (from host):
#   docker exec tokentrail-api bash scripts/safe_migrate.sh
#
# What it does:
#   1. Checks current alembic version
#   2. Counts rows in core tables (warns if data exists)
#   3. Creates a pg_dump backup before migrating
#   4. Runs alembic upgrade head
#   5. Verifies the migration succeeded
# =============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ---------------------------------------------------------------------------
# Resolve database URL
# ---------------------------------------------------------------------------
SYNC_URL="${SYNC_DATABASE_URL:-}"
if [ -z "$SYNC_URL" ]; then
    # Derive sync URL from async DATABASE_URL
    ASYNC_URL="${DATABASE_URL:-}"
    if [ -z "$ASYNC_URL" ]; then
        error "Neither SYNC_DATABASE_URL nor DATABASE_URL is set."
        exit 1
    fi
    SYNC_URL="${ASYNC_URL//\+asyncpg/}"
fi

echo "============================================="
echo "  TokenTrail Safe Migration"
echo "============================================="
echo ""

# ---------------------------------------------------------------------------
# 1. Check current alembic version
# ---------------------------------------------------------------------------
echo "--- Step 1: Current Migration State ---"

CURRENT_VERSION=$(python -c "
from sqlalchemy import create_engine, text, inspect
engine = create_engine('$SYNC_URL')
inspector = inspect(engine)
tables = inspector.get_table_names()
if 'alembic_version' not in tables:
    print('NONE')
else:
    with engine.connect() as conn:
        r = conn.execute(text('SELECT version_num FROM alembic_version'))
        row = r.fetchone()
        print(row[0] if row else 'EMPTY')
" 2>/dev/null || echo "ERROR")

if [ "$CURRENT_VERSION" = "ERROR" ]; then
    error "Could not connect to database."
    exit 1
fi

if [ "$CURRENT_VERSION" = "NONE" ]; then
    log "No alembic_version table — fresh database. Migrations will create all tables."
elif [ "$CURRENT_VERSION" = "EMPTY" ]; then
    warn "alembic_version table exists but is empty."
else
    log "Current alembic version: $CURRENT_VERSION"
fi

# ---------------------------------------------------------------------------
# 2. Check for existing data
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 2: Data Check ---"

DATA_CHECK=$(python -c "
from sqlalchemy import create_engine, text, inspect
engine = create_engine('$SYNC_URL')
inspector = inspect(engine)
tables = inspector.get_table_names()
core = ['tenants','users','end_customers','api_keys','usage_events','alerts',
        'routing_decisions','agent_workflows','billing_periods','pricing_plans']
has_data = False
for t in core:
    if t in tables:
        with engine.connect() as conn:
            count = conn.execute(text(f'SELECT COUNT(*) FROM {t}')).scalar()
            if count > 0:
                has_data = True
                print(f'  {t}: {count} rows')
if not has_data:
    print('NO_DATA')
" 2>/dev/null || echo "CHECK_ERROR")

if [ "$DATA_CHECK" = "CHECK_ERROR" ]; then
    warn "Could not check table data."
elif [ "$DATA_CHECK" = "NO_DATA" ]; then
    log "Core tables are empty or don't exist. Safe to migrate."
else
    warn "Database contains existing data:"
    echo "$DATA_CHECK"
    echo ""
fi

# ---------------------------------------------------------------------------
# 3. Create backup
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 3: Pre-Migration Backup ---"

# Parse connection info from URL
DB_HOST=$(python -c "from urllib.parse import urlparse; u=urlparse('$SYNC_URL'); print(u.hostname)" 2>/dev/null)
DB_PORT=$(python -c "from urllib.parse import urlparse; u=urlparse('$SYNC_URL'); print(u.port or 5432)" 2>/dev/null)
DB_NAME=$(python -c "from urllib.parse import urlparse; u=urlparse('$SYNC_URL'); print(u.path.lstrip('/'))" 2>/dev/null)
DB_USER=$(python -c "from urllib.parse import urlparse; u=urlparse('$SYNC_URL'); print(u.username)" 2>/dev/null)
DB_PASS=$(python -c "from urllib.parse import urlparse; u=urlparse('$SYNC_URL'); print(u.password)" 2>/dev/null)

BACKUP_DIR="/tmp/db_backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/tokentrail_pre_migrate_${TIMESTAMP}.sql"

if command -v pg_dump &>/dev/null; then
    export PGPASSWORD="$DB_PASS"
    if pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
        --no-owner --no-acl --schema=public \
        -f "$BACKUP_FILE" 2>/dev/null; then
        BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
        log "Backup created: $BACKUP_FILE ($BACKUP_SIZE)"
    else
        warn "pg_dump failed. Continuing without local backup."
        warn "RDS automated backups (7-day retention) are still in place."
        BACKUP_FILE=""
    fi
    unset PGPASSWORD
else
    warn "pg_dump not available in container. Skipping local backup."
    warn "RDS automated backups (7-day retention) are still in place."
    BACKUP_FILE=""
fi

# ---------------------------------------------------------------------------
# 4. Run migration
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 4: Running Migration ---"

# Get target version
TARGET_VERSION=$(python -c "
import importlib, os, sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath('.'))))
versions_dir = 'alembic/versions' if os.path.isdir('alembic/versions') else '/app/alembic/versions'
files = sorted([f for f in os.listdir(versions_dir) if f.endswith('.py') and not f.startswith('__')])
if files:
    last = files[-1]
    # Extract revision from filename (e.g., 016_add_foo.py -> 016)
    print(last.split('_')[0])
else:
    print('unknown')
" 2>/dev/null || echo "unknown")

echo "Migrating from $CURRENT_VERSION → $TARGET_VERSION (head)"
echo ""

if ! alembic upgrade head 2>&1; then
    error "Migration FAILED!"
    if [ -n "${BACKUP_FILE:-}" ]; then
        echo ""
        error "To restore from backup:"
        error "  PGPASSWORD='...' psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < $BACKUP_FILE"
    fi
    exit 1
fi

# ---------------------------------------------------------------------------
# 5. Verify
# ---------------------------------------------------------------------------
echo ""
echo "--- Step 5: Verification ---"

NEW_VERSION=$(python -c "
from sqlalchemy import create_engine, text
engine = create_engine('$SYNC_URL')
with engine.connect() as conn:
    r = conn.execute(text('SELECT version_num FROM alembic_version'))
    row = r.fetchone()
    print(row[0] if row else 'UNKNOWN')
" 2>/dev/null || echo "ERROR")

if [ "$NEW_VERSION" = "$TARGET_VERSION" ]; then
    log "Migration successful! Now at version: $NEW_VERSION"
elif [ "$NEW_VERSION" = "ERROR" ]; then
    error "Could not verify migration version."
    exit 1
else
    warn "Migration completed but version is $NEW_VERSION (expected $TARGET_VERSION)"
fi

TABLE_COUNT=$(python -c "
from sqlalchemy import create_engine, inspect
engine = create_engine('$SYNC_URL')
inspector = inspect(engine)
tables = [t for t in inspector.get_table_names() if not t.startswith('LiteLLM_') and t != '_prisma_migrations' and t != 'alembic_version']
print(len(tables))
" 2>/dev/null || echo "?")

log "Application tables: $TABLE_COUNT"

echo ""
echo "============================================="
echo "  Migration Complete"
echo "============================================="
