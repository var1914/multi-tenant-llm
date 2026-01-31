from fastapi import Depends, HTTPException, Query, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID

from app.database import get_db
from app.utils.auth import decode_access_token
from app.models.user import User

security = HTTPBearer()


async def _resolve_user(token: str, db: AsyncSession) -> User:
    """Shared logic to decode token and fetch user."""
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = UUID(payload.get("sub"))

    result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.tenant))
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    return await _resolve_user(credentials.credentials, db)


async def get_current_user_sse(
    token: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Auth dependency for SSE endpoints. Reads token from query param.

    EventSource API cannot send custom headers, so the JWT is passed
    as a ?token= query parameter instead.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token query parameter required for SSE endpoints",
        )
    return await _resolve_user(token, db)


async def get_current_tenant_id(user: User = Depends(get_current_user)) -> UUID:
    return user.tenant_id


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
