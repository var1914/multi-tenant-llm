from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserResponse
from app.services.auth_service import AuthService
from app.dependencies import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def _user_response(user: User, tenant=None) -> dict:
    """Build UserResponse dict with tenant fields merged in."""
    resp = UserResponse.model_validate(user).model_dump()
    # Use provided tenant or access loaded tenant (must be eagerly loaded)
    t = tenant
    if not t and hasattr(user, "__dict__") and "tenant" in user.__dict__:
        t = user.__dict__["tenant"]
    if t:
        resp["trial_credits_usd"] = t.trial_credits_usd
        resp["company_name"] = t.company_name
        resp["is_demo"] = t.is_demo
    return resp


@router.post("/register", response_model=dict)
async def register(data: UserRegister, db: AsyncSession = Depends(get_db)):
    """Register a new user and create their tenant."""
    service = AuthService(db)
    try:
        user, tenant, token = await service.register(data)
        return {
            "user": _user_response(user, tenant),
            "access_token": token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/login", response_model=dict)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    service = AuthService(db)
    try:
        user, token = await service.login(data)
        return {
            "user": _user_response(user),
            "access_token": token,
            "token_type": "bearer",
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        }
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(e))


@router.post("/demo-login", response_model=dict)
@limiter.limit("10/minute")
async def demo_login(request: Request, db: AsyncSession = Depends(get_db)):
    """Auto-login to demo account. No password required.

    Security:
    - Rate limited to 10 requests per minute per IP (prevents DoS)
    - Demo sessions expire in 30 minutes (shorter than regular sessions)
    - The is_demo claim in JWT prevents database lookups on every write request
    """
    from datetime import timedelta
    from app.utils.auth import create_access_token

    result = await db.execute(
        select(User)
        .where(User.email == "demo@tokentrail.com")
        .options(selectinload(User.tenant))
    )
    user = result.scalar_one_or_none()

    if not user or not user.tenant or not user.tenant.is_demo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Demo account not found"
        )

    # Demo tokens expire in 30 minutes (vs. regular session expiry)
    DEMO_SESSION_MINUTES = 30

    token = create_access_token(
        user_id=user.id,
        tenant_id=user.tenant_id,
        email=user.email,
        role=user.role,
        expires_delta=timedelta(minutes=DEMO_SESSION_MINUTES),
        extra_claims={"is_demo": True}  # Signed claim, prevents DB lookup
    )

    return {
        "user": _user_response(user),
        "access_token": token,
        "token_type": "bearer",
        "expires_in": DEMO_SESSION_MINUTES * 60,
        "is_demo": True,
    }


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get current authenticated user with tenant info."""
    result = await db.execute(
        select(User).options(selectinload(User.tenant)).where(User.id == current_user.id)
    )
    user = result.scalar_one()
    return _user_response(user)
