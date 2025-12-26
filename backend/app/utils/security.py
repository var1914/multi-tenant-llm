import secrets
from passlib.context import CryptContext
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def generate_api_key(environment: str = "production") -> tuple[str, str, str]:
    """
    Generate an API key.
    Returns: (full_key, prefix, hash)
    """
    prefix = settings.API_KEY_PREFIX_LIVE if environment == "production" else settings.API_KEY_PREFIX_TEST
    random_part = secrets.token_urlsafe(32)
    full_key = f"{prefix}{random_part}"
    key_hash = pwd_context.hash(full_key)

    # key_prefix shows first 8 chars of random part for identification
    return full_key, prefix + random_part[:8], key_hash


def verify_api_key(api_key: str, key_hash: str) -> bool:
    """Verify an API key against its hash."""
    return pwd_context.verify(api_key, key_hash)
