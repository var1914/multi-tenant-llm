"""Admin API endpoints for platform management."""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.user import User
from app.services.admin_service import AdminService


router = APIRouter()


class UserUpdateRequest(BaseModel):
    is_active: Optional[bool] = None
    role: Optional[str] = None


@router.get("/stats")
async def get_platform_stats(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get overall platform statistics. Admin only."""
    service = AdminService(db)
    return await service.get_platform_stats()


@router.get("/signups")
async def get_signups_over_time(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get daily signup counts. Admin only."""
    service = AdminService(db)
    return await service.get_signups_over_time(days)


@router.get("/usage-over-time")
async def get_usage_over_time(
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get daily usage statistics. Admin only."""
    service = AdminService(db)
    return await service.get_usage_over_time(days)


@router.get("/recent-users")
async def get_recent_users(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get recently registered users. Admin only."""
    service = AdminService(db)
    return await service.get_recent_users(limit)


@router.get("/top-tenants")
async def get_top_tenants(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get top tenants by API usage. Admin only."""
    service = AdminService(db)
    return await service.get_top_tenants_by_usage(limit)


@router.get("/model-usage")
async def get_model_usage(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get usage breakdown by model. Admin only."""
    service = AdminService(db)
    return await service.get_model_usage_breakdown()


@router.get("/users")
async def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Get all users with pagination. Admin only."""
    service = AdminService(db)
    users, total = await service.get_all_users(skip, limit, search)
    return {
        "users": users,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.patch("/users/{user_id}")
async def update_user(
    user_id: UUID,
    data: UserUpdateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    """Update a user's status or role. Admin only."""
    service = AdminService(db)
    updated = await service.update_user_status(
        user_id,
        is_active=data.is_active,
        role=data.role
    )
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return updated
