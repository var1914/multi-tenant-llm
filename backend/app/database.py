from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool, AsyncAdaptedQueuePool
from app.config import settings
import os

# Determine if we're using PgBouncer (production) or direct connection (development)
# PgBouncer handles connection pooling, so we use NullPool to avoid double-pooling
USE_PGBOUNCER = os.getenv("USE_PGBOUNCER", "false").lower() == "true"

# Pool settings from environment (for flexibility)
DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "1800"))  # 30 minutes
DB_POOL_TIMEOUT = int(os.getenv("DB_POOL_TIMEOUT", "30"))

# Engine configuration
if USE_PGBOUNCER:
    # PgBouncer mode: Use NullPool since PgBouncer handles pooling
    # This prevents "prepared statement already exists" errors with transaction pooling
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        poolclass=NullPool,
        # Disable server-side cursors and prepared statements for PgBouncer compatibility
        connect_args={
            "prepared_statement_cache_size": 0,  # Disable prepared statements
            "statement_cache_size": 0,
        },
    )
else:
    # Direct connection mode: Use connection pooling
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=settings.DEBUG,
        poolclass=AsyncAdaptedQueuePool,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_pre_ping=True,  # Verify connections before use
        pool_recycle=DB_POOL_RECYCLE,  # Recycle connections after 30 min
        pool_timeout=DB_POOL_TIMEOUT,  # Wait max 30s for connection
        pool_use_lifo=True,  # Use LIFO to reuse recent connections (better for caching)
    )

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """
    Dependency that provides a database session.
    Automatically closes the session when the request is done.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_db_for_background_task() -> AsyncSession:
    """
    Get a database session for background tasks.
    Caller is responsible for closing the session.
    """
    return AsyncSessionLocal()


# Health check function
async def check_db_connection() -> bool:
    """Check if database connection is healthy."""
    try:
        async with AsyncSessionLocal() as session:
            await session.execute("SELECT 1")
            return True
    except Exception:
        return False
