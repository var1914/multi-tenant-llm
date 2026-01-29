from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserResponse
from app.services.auth_service import AuthService
from app.dependencies import get_current_user
from app.models.user import User
from app.config import settings

router = APIRouter()


def _user_response(user: User, tenant=None) -> dict:
    """Build UserResponse dict with tenant fields merged in."""
    resp = UserResponse.model_validate(user).model_dump()
    t = tenant or getattr(user, "tenant", None)
    if t:
        resp["trial_credits_usd"] = t.trial_credits_usd
        resp["company_name"] = t.company_name
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
