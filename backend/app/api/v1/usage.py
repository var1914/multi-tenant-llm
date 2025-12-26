from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
import csv
import io

from app.database import get_db
from app.schemas.usage import (
    UsageEventCreate, UsageEventResponse, UsageSummary,
    AnalyticsSummary, ModelUsageBreakdown, CustomerUsageBreakdown, DailyUsage, FeatureUsageBreakdown
)
from app.services.usage_service import UsageService
from app.middleware.api_key_auth import get_tenant_from_api_key
from app.models.tenant import Tenant
from app.models.usage_event import UsageEvent
from app.models.end_customer import EndCustomer
from app.dependencies import get_current_tenant_id

router = APIRouter()


@router.post("/track", response_model=UsageEventResponse)
async def track_usage(
    data: UsageEventCreate,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Track a usage event for a customer.
    This endpoint uses API key authentication.

    The idempotency_key ensures duplicate events are not recorded.
    If the same idempotency_key is sent again, the original event is returned.
    """
    service = UsageService(db)
    try:
        return await service.track_event(tenant.id, data)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/summary", response_model=UsageSummary)
async def get_usage_summary(
    customer_id: Optional[str] = Query(None, description="Filter by customer external_id"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Get usage summary for the tenant using API key authentication.
    Optionally filter by customer_id and date range.
    """
    service = UsageService(db)
    return await service.get_summary(
        tenant_id=tenant.id,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/dashboard/summary", response_model=UsageSummary)
async def get_dashboard_summary(
    customer_id: Optional[str] = Query(None, description="Filter by customer external_id"),
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get usage summary for the dashboard using JWT authentication.
    Optionally filter by customer_id and date range.
    """
    service = UsageService(db)
    return await service.get_summary(
        tenant_id=tenant_id,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date
    )


@router.get("/dashboard/analytics", response_model=AnalyticsSummary)
async def get_dashboard_analytics(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get comprehensive analytics including usage by model, customer, and daily trends.
    """
    service = UsageService(db)
    return await service.get_analytics(tenant_id)


@router.get("/dashboard/by-model", response_model=list[ModelUsageBreakdown])
async def get_usage_by_model(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get usage breakdown by model and provider."""
    service = UsageService(db)
    return await service.get_usage_by_model(tenant_id)


@router.get("/dashboard/by-customer", response_model=list[CustomerUsageBreakdown])
async def get_usage_by_customer(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get usage breakdown by customer."""
    service = UsageService(db)
    return await service.get_usage_by_customer(tenant_id)


@router.get("/dashboard/daily", response_model=list[DailyUsage])
async def get_daily_usage(
    days: int = Query(30, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get daily usage for the specified number of days."""
    service = UsageService(db)
    return await service.get_daily_usage(tenant_id, days)


@router.get("/dashboard/by-feature", response_model=list[FeatureUsageBreakdown])
async def get_usage_by_feature(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """Get usage breakdown by feature/event_type."""
    service = UsageService(db)
    return await service.get_usage_by_feature(tenant_id)


@router.get("/export/csv")
async def export_usage_csv(
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    days: int = Query(30, description="Number of days to export (if no date range specified)"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Export usage events as CSV for billing integration.
    Returns: CSV file with columns: date, customer_id, customer_name, event_type, model, provider, tokens, cost_usd
    """
    # Default to last N days if no date range specified
    if not start_date:
        start_date = datetime.utcnow() - timedelta(days=days)
    if not end_date:
        end_date = datetime.utcnow()

    # Query usage events with customer info
    result = await db.execute(
        select(UsageEvent, EndCustomer.external_id, EndCustomer.name)
        .join(EndCustomer, UsageEvent.end_customer_id == EndCustomer.id)
        .where(
            UsageEvent.tenant_id == tenant_id,
            UsageEvent.event_timestamp >= start_date,
            UsageEvent.event_timestamp <= end_date
        )
        .order_by(UsageEvent.event_timestamp)
    )
    rows = result.all()

    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        'date', 'timestamp', 'customer_id', 'customer_name', 'event_type',
        'model', 'provider', 'tokens', 'cost_usd', 'idempotency_key'
    ])

    # Data rows
    for event, customer_external_id, customer_name in rows:
        writer.writerow([
            event.event_timestamp.strftime('%Y-%m-%d'),
            event.event_timestamp.isoformat(),
            customer_external_id,
            customer_name or '',
            event.event_type,
            event.model or '',
            event.provider or '',
            event.quantity,
            str(event.cost_usd) if event.cost_usd else '0',
            event.idempotency_key
        ])

    output.seek(0)

    # Generate filename with date range
    filename = f"usage_export_{start_date.strftime('%Y%m%d')}_{end_date.strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@router.get("/export/summary-csv")
async def export_summary_csv(
    start_date: Optional[datetime] = Query(None, description="Start date filter"),
    end_date: Optional[datetime] = Query(None, description="End date filter"),
    days: int = Query(30, description="Number of days to export (if no date range specified)"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Export usage summary by customer as CSV for billing.
    Returns: CSV file with columns: customer_id, customer_name, total_events, total_tokens, total_cost_usd
    """
    service = UsageService(db)
    by_customer = await service.get_usage_by_customer(tenant_id)

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow(['customer_id', 'customer_name', 'total_events', 'total_tokens', 'total_cost_usd'])

    for c in by_customer:
        writer.writerow([
            c.customer_id,
            c.customer_name or '',
            c.event_count,
            c.total_quantity,
            str(c.total_cost_usd)
        ])

    output.seek(0)

    filename = f"usage_summary_{datetime.utcnow().strftime('%Y%m%d')}.csv"

    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
