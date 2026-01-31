from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.api.v1.router import api_router
from app.middleware.tenant_context import TenantContextMiddleware
from app.middleware.read_only_demo import ReadOnlyDemoMiddleware


async def _check_db_isolation():
    """Warn loudly if LiteLLM prisma tables exist in our database.

    LiteLLM's prisma generates DROP TABLE for tables it doesn't own.
    Sharing a database will cause data loss on every LiteLLM restart.
    """
    import logging
    from sqlalchemy import create_engine, inspect
    log = logging.getLogger("tokentrail.startup")
    try:
        url = settings.SYNC_DATABASE_URL or str(settings.DATABASE_URL).replace("+asyncpg", "")
        engine = create_engine(url)
        inspector = inspect(engine)
        litellm_tables = [t for t in inspector.get_table_names() if t.startswith("LiteLLM_")]
        engine.dispose()
        if litellm_tables:
            msg = (
                "\n!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n"
                "DATABASE ISOLATION VIOLATION: Found %d LiteLLM tables in the app database.\n"
                "LiteLLM's prisma WILL DROP all app tables on its next restart.\n"
                "Set LITELLM_DATABASE_URL to a SEPARATE database immediately.\n"
                "!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!\n"
            )
            log.critical(msg, len(litellm_tables))
            print(msg % len(litellm_tables))
    except Exception as e:
        log.warning("DB isolation check failed: %s", e)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print(f"Starting {settings.APP_NAME} in {settings.ENVIRONMENT} mode")
    await _check_db_isolation()
    yield
    # Shutdown
    print(f"Shutting down {settings.APP_NAME}")


app = FastAPI(
    title=settings.APP_NAME,
    description="Multi-tenant LLM Billing Platform API",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS - allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://frontend:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom middleware
app.add_middleware(TenantContextMiddleware)
app.add_middleware(ReadOnlyDemoMiddleware)

# Include API routes
app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestration."""
    return {"status": "healthy", "service": settings.APP_NAME}


@app.get("/")
async def root():
    """Root endpoint with API information."""
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "docs": "/docs" if settings.DEBUG else "Disabled in production",
        "version": "1.0.0",
    }
