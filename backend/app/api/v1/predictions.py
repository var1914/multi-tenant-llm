"""
Predictive Budget Alerts API endpoints.

Provides endpoints for viewing forecasts, managing alerts, and configuring prediction settings.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, desc, and_
from datetime import datetime

from app.database import get_db as get_async_session
from app.models.tenant import Tenant
from app.models.end_customer import EndCustomer
from app.models.prediction_alert import PredictionAlert
from app.dependencies import get_current_user
from app.models.user import User
from app.services.prediction_service import PredictionService, UsageForecast, BudgetAlert

router = APIRouter()


# Request/Response Models
class PredictionSettingsUpdate(BaseModel):
    prediction_alerts_enabled: Optional[bool] = None


class PredictionSettingsResponse(BaseModel):
    prediction_alerts_enabled: bool
    total_customers: int
    customers_with_budget: int


class ForecastResponse(BaseModel):
    customer_id: str
    customer_name: Optional[str]
    current_spend: float
    budget_limit: Optional[float]
    forecasted_spend_eom: float
    forecasted_spend_7d: float
    forecasted_spend_30d: float
    daily_average: float
    daily_trend: float
    days_until_budget_exceeded: Optional[int]
    budget_utilization_percent: float
    confidence_score: float
    risk_level: str
    prediction_factors: List[str]


class AlertResponse(BaseModel):
    id: UUID
    customer_id: UUID
    customer_external_id: str
    customer_name: Optional[str]
    alert_type: str
    current_spend: float
    budget_limit: float
    utilization_percent: float
    forecasted_exceed_date: Optional[datetime]
    message: str
    recommendations: List[str]
    status: str
    created_at: datetime
    acknowledged_at: Optional[datetime]
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class AlertAcknowledge(BaseModel):
    acknowledged: bool = True


class AlertResolve(BaseModel):
    resolution_notes: Optional[str] = None


class PredictionSummaryResponse(BaseModel):
    total_customers: int
    customers_with_budget: int
    risk_distribution: dict
    at_risk_count: int
    total_current_spend: float
    total_forecasted_30d: float
    average_confidence: float
    high_risk_customers: List[dict]


class CustomerForecastRequest(BaseModel):
    customer_id: str


# Endpoints
@router.get("/settings", response_model=PredictionSettingsResponse)
async def get_prediction_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get current prediction settings for the tenant."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Count customers
    customers_result = await db.execute(
        select(EndCustomer).where(EndCustomer.tenant_id == current_user.tenant_id)
    )
    customers = customers_result.scalars().all()

    return PredictionSettingsResponse(
        prediction_alerts_enabled=tenant.prediction_alerts_enabled if hasattr(tenant, 'prediction_alerts_enabled') and tenant.prediction_alerts_enabled is not None else True,
        total_customers=len(customers),
        customers_with_budget=sum(1 for c in customers if c.budget_limit_usd),
    )


@router.put("/settings", response_model=PredictionSettingsResponse)
async def update_prediction_settings(
    settings: PredictionSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Update prediction settings for the tenant."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if settings.prediction_alerts_enabled is not None:
        tenant.prediction_alerts_enabled = settings.prediction_alerts_enabled

    await db.commit()
    await db.refresh(tenant)

    # Count customers
    customers_result = await db.execute(
        select(EndCustomer).where(EndCustomer.tenant_id == current_user.tenant_id)
    )
    customers = customers_result.scalars().all()

    return PredictionSettingsResponse(
        prediction_alerts_enabled=tenant.prediction_alerts_enabled if tenant.prediction_alerts_enabled is not None else True,
        total_customers=len(customers),
        customers_with_budget=sum(1 for c in customers if c.budget_limit_usd),
    )


@router.get("/summary", response_model=PredictionSummaryResponse)
async def get_prediction_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get prediction summary for all customers."""
    service = PredictionService(db)
    summary = await service.get_tenant_prediction_summary(current_user.tenant_id)
    return PredictionSummaryResponse(**summary)


@router.get("/forecasts", response_model=List[ForecastResponse])
async def get_all_forecasts(
    risk_filter: Optional[str] = Query(None, pattern="^(low|medium|high|critical|at_risk)$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get forecasts for all customers."""
    service = PredictionService(db)
    forecasts = await service.get_all_forecasts(current_user.tenant_id, risk_filter)

    return [
        ForecastResponse(
            customer_id=f.customer_id,
            customer_name=f.customer_name,
            current_spend=f.current_spend,
            budget_limit=f.budget_limit,
            forecasted_spend_eom=f.forecasted_spend_eom,
            forecasted_spend_7d=f.forecasted_spend_7d,
            forecasted_spend_30d=f.forecasted_spend_30d,
            daily_average=f.daily_average,
            daily_trend=f.daily_trend,
            days_until_budget_exceeded=f.days_until_budget_exceeded,
            budget_utilization_percent=f.budget_utilization_percent,
            confidence_score=f.confidence_score,
            risk_level=f.risk_level,
            prediction_factors=f.prediction_factors,
        )
        for f in forecasts
    ]


@router.get("/forecasts/{customer_external_id}", response_model=ForecastResponse)
async def get_customer_forecast(
    customer_external_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get forecast for a specific customer."""
    # Find the customer
    result = await db.execute(
        select(EndCustomer)
        .where(EndCustomer.tenant_id == current_user.tenant_id)
        .where(EndCustomer.external_id == customer_external_id)
    )
    customer = result.scalar_one_or_none()

    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    service = PredictionService(db)
    forecast = await service.forecast_customer(current_user.tenant_id, customer)

    return ForecastResponse(
        customer_id=forecast.customer_id,
        customer_name=forecast.customer_name,
        current_spend=forecast.current_spend,
        budget_limit=forecast.budget_limit,
        forecasted_spend_eom=forecast.forecasted_spend_eom,
        forecasted_spend_7d=forecast.forecasted_spend_7d,
        forecasted_spend_30d=forecast.forecasted_spend_30d,
        daily_average=forecast.daily_average,
        daily_trend=forecast.daily_trend,
        days_until_budget_exceeded=forecast.days_until_budget_exceeded,
        budget_utilization_percent=forecast.budget_utilization_percent,
        confidence_score=forecast.confidence_score,
        risk_level=forecast.risk_level,
        prediction_factors=forecast.prediction_factors,
    )


@router.get("/alerts", response_model=List[AlertResponse])
async def get_alerts(
    status: Optional[str] = Query(None, pattern="^(active|acknowledged|resolved)$"),
    alert_type: Optional[str] = Query(None, pattern="^(warning|critical|exceeded)$"),
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get budget alerts."""
    query = (
        select(PredictionAlert)
        .where(PredictionAlert.tenant_id == current_user.tenant_id)
        .order_by(desc(PredictionAlert.created_at))
    )

    if status:
        query = query.where(PredictionAlert.status == status)

    if alert_type:
        query = query.where(PredictionAlert.alert_type == alert_type)

    query = query.limit(limit)

    result = await db.execute(query)
    alerts = result.scalars().all()

    # Get customer details
    response_alerts = []
    for alert in alerts:
        customer_result = await db.execute(
            select(EndCustomer).where(EndCustomer.id == alert.end_customer_id)
        )
        customer = customer_result.scalar_one_or_none()

        response_alerts.append(AlertResponse(
            id=alert.id,
            customer_id=alert.end_customer_id,
            customer_external_id=customer.external_id if customer else "unknown",
            customer_name=customer.name if customer else None,
            alert_type=alert.alert_type,
            current_spend=float(alert.current_spend),
            budget_limit=float(alert.budget_limit),
            utilization_percent=float(alert.utilization_percent),
            forecasted_exceed_date=alert.forecasted_exceed_date,
            message=alert.message,
            recommendations=alert.recommendations or [],
            status=alert.status,
            created_at=alert.created_at,
            acknowledged_at=alert.acknowledged_at,
            resolved_at=alert.resolved_at,
        ))

    return response_alerts


@router.post("/alerts/generate", response_model=List[AlertResponse])
async def generate_alerts(
    threshold_percent: float = Query(80, ge=0, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Generate new budget alerts based on current forecasts."""
    service = PredictionService(db)
    budget_alerts = await service.generate_budget_alerts(
        current_user.tenant_id,
        threshold_percent
    )

    # Store alerts in database
    stored_alerts = []
    for alert in budget_alerts:
        # Check if similar alert already exists and is active
        existing = await db.execute(
            select(PredictionAlert)
            .where(PredictionAlert.tenant_id == current_user.tenant_id)
            .where(PredictionAlert.end_customer_id == alert.customer_id)
            .where(PredictionAlert.alert_type == alert.alert_type)
            .where(PredictionAlert.status == 'active')
        )
        if existing.scalar_one_or_none():
            continue

        new_alert = PredictionAlert(
            tenant_id=current_user.tenant_id,
            end_customer_id=alert.customer_id,
            alert_type=alert.alert_type,
            current_spend=alert.current_spend,
            budget_limit=alert.budget_limit,
            utilization_percent=alert.utilization_percent,
            forecasted_exceed_date=alert.forecasted_exceed_date,
            message=alert.message,
            recommendations=alert.recommendations,
            status='active',
        )
        db.add(new_alert)
        stored_alerts.append(new_alert)

    await db.commit()

    # Refresh and return
    response_alerts = []
    for alert in stored_alerts:
        await db.refresh(alert)
        customer_result = await db.execute(
            select(EndCustomer).where(EndCustomer.id == alert.end_customer_id)
        )
        customer = customer_result.scalar_one_or_none()

        response_alerts.append(AlertResponse(
            id=alert.id,
            customer_id=alert.end_customer_id,
            customer_external_id=customer.external_id if customer else "unknown",
            customer_name=customer.name if customer else None,
            alert_type=alert.alert_type,
            current_spend=float(alert.current_spend),
            budget_limit=float(alert.budget_limit),
            utilization_percent=float(alert.utilization_percent),
            forecasted_exceed_date=alert.forecasted_exceed_date,
            message=alert.message,
            recommendations=alert.recommendations or [],
            status=alert.status,
            created_at=alert.created_at,
            acknowledged_at=alert.acknowledged_at,
            resolved_at=alert.resolved_at,
        ))

    return response_alerts


@router.put("/alerts/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Acknowledge a budget alert."""
    result = await db.execute(
        select(PredictionAlert)
        .where(PredictionAlert.id == alert_id)
        .where(PredictionAlert.tenant_id == current_user.tenant_id)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = 'acknowledged'
    alert.acknowledged_at = datetime.utcnow()
    alert.acknowledged_by = current_user.id

    await db.commit()
    await db.refresh(alert)

    customer_result = await db.execute(
        select(EndCustomer).where(EndCustomer.id == alert.end_customer_id)
    )
    customer = customer_result.scalar_one_or_none()

    return AlertResponse(
        id=alert.id,
        customer_id=alert.end_customer_id,
        customer_external_id=customer.external_id if customer else "unknown",
        customer_name=customer.name if customer else None,
        alert_type=alert.alert_type,
        current_spend=float(alert.current_spend),
        budget_limit=float(alert.budget_limit),
        utilization_percent=float(alert.utilization_percent),
        forecasted_exceed_date=alert.forecasted_exceed_date,
        message=alert.message,
        recommendations=alert.recommendations or [],
        status=alert.status,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
    )


@router.put("/alerts/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: UUID,
    resolve_data: AlertResolve,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Resolve a budget alert."""
    result = await db.execute(
        select(PredictionAlert)
        .where(PredictionAlert.id == alert_id)
        .where(PredictionAlert.tenant_id == current_user.tenant_id)
    )
    alert = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    alert.status = 'resolved'
    alert.resolved_at = datetime.utcnow()
    if resolve_data.resolution_notes:
        alert.resolution_notes = resolve_data.resolution_notes

    await db.commit()
    await db.refresh(alert)

    customer_result = await db.execute(
        select(EndCustomer).where(EndCustomer.id == alert.end_customer_id)
    )
    customer = customer_result.scalar_one_or_none()

    return AlertResponse(
        id=alert.id,
        customer_id=alert.end_customer_id,
        customer_external_id=customer.external_id if customer else "unknown",
        customer_name=customer.name if customer else None,
        alert_type=alert.alert_type,
        current_spend=float(alert.current_spend),
        budget_limit=float(alert.budget_limit),
        utilization_percent=float(alert.utilization_percent),
        forecasted_exceed_date=alert.forecasted_exceed_date,
        message=alert.message,
        recommendations=alert.recommendations or [],
        status=alert.status,
        created_at=alert.created_at,
        acknowledged_at=alert.acknowledged_at,
        resolved_at=alert.resolved_at,
    )


@router.get("/alerts/stats")
async def get_alert_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get alert statistics."""
    from sqlalchemy import func

    # Count by status
    status_counts = {}
    for status in ['active', 'acknowledged', 'resolved']:
        result = await db.execute(
            select(func.count(PredictionAlert.id))
            .where(PredictionAlert.tenant_id == current_user.tenant_id)
            .where(PredictionAlert.status == status)
        )
        status_counts[status] = result.scalar() or 0

    # Count by type
    type_counts = {}
    for alert_type in ['warning', 'critical', 'exceeded']:
        result = await db.execute(
            select(func.count(PredictionAlert.id))
            .where(PredictionAlert.tenant_id == current_user.tenant_id)
            .where(PredictionAlert.alert_type == alert_type)
            .where(PredictionAlert.status == 'active')
        )
        type_counts[alert_type] = result.scalar() or 0

    return {
        "by_status": status_counts,
        "active_by_type": type_counts,
        "total_active": status_counts.get('active', 0),
        "total_all_time": sum(status_counts.values()),
    }
