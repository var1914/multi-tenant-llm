from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter()


@router.get("/current")
async def get_current_tenant(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get the current user's tenant information."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one()

    return {
        "id": str(tenant.id),
        "company_name": tenant.company_name,
        "slug": tenant.slug,
        "subscription_status": tenant.subscription_status,
        "subscription_plan": tenant.subscription_plan,
        "created_at": tenant.created_at.isoformat(),
    }
