from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Application
    APP_NAME: str = "TokenTrail"
    ENVIRONMENT: str = "development"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:3000"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://tokentrail:tokentrail_dev@localhost:5432/tokentrail"
    SYNC_DATABASE_URL: str = "postgresql://tokentrail:tokentrail_dev@localhost:5432/tokentrail"

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # LiteLLM
    LITELLM_PROXY_URL: str = "http://localhost:4000"

    # Internal API Key for service-to-service communication (LiteLLM callback)
    TOKENTRAIL_INTERNAL_API_KEY: str = "internal-api-key"

    # API Key Settings
    API_KEY_PREFIX_LIVE: str = "tt_live_"
    API_KEY_PREFIX_TEST: str = "tt_test_"

    # Stripe (use test keys for local development)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
