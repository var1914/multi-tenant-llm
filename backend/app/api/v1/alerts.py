from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from typing import List

from app.database import get_db
from app.schemas.alerts import AlertResponse, BudgetAlertCheck
from app.services.alert_service import AlertService
from app.dependencies import get_current_tenant_id

router = APIRouter()


@router.post("/check", response_model=BudgetAlertCheck)
async def check_budget_alerts(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Check all customers for budget alerts and create alerts as needed.
    This endpoint can be called manually or scheduled via a cron job.
    """
    service = AlertService(db)
    return await service.check_and_create_alerts(tenant_id)


@router.get("", response_model=List[AlertResponse])
async def get_recent_alerts(
    days: int = Query(7, ge=1, le=30, description="Number of days to look back"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get recent alerts for the tenant."""
    service = AlertService(db)
    return await service.get_recent_alerts(tenant_id, days, limit)


@router.get("/customer/{customer_id}", response_model=List[AlertResponse])
async def get_customer_alerts(
    customer_id: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get alerts for a specific customer."""
    service = AlertService(db)
    return await service.get_alerts_for_customer(tenant_id, customer_id, limit)
