from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, cast, Date
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from decimal import Decimal

from app.models.usage_event import UsageEvent
from app.models.end_customer import EndCustomer
from app.schemas.usage import (
    UsageEventCreate, UsageEventResponse, UsageSummary,
    ModelUsageBreakdown, CustomerUsageBreakdown, DailyUsage, FeatureUsageBreakdown, AnalyticsSummary
)
from app.services.customer_service import CustomerService


class UsageService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_service = CustomerService(db)

    async def track_event(self, tenant_id: UUID, data: UsageEventCreate) -> UsageEventResponse:
        # Check for existing idempotency key
        result = await self.db.execute(
            select(UsageEvent).where(UsageEvent.idempotency_key == data.idempotency_key)
        )
        existing = result.scalar_one_or_none()

        if existing:
            return UsageEventResponse(
                success=True,
                event_id=existing.id,
                customer_id=data.customer_id,
                quantity=existing.quantity,
                cost_usd=existing.cost_usd,
                timestamp=existing.event_timestamp,
            )

        # Get or create customer
        customer = await self.customer_service.get_or_create(tenant_id, data.customer_id)

        # Create usage event
        event = UsageEvent(
            tenant_id=tenant_id,
            end_customer_id=customer.id,
            event_timestamp=data.timestamp or datetime.utcnow(),
            event_type=data.event_type,
            model=data.model,
            provider=data.provider,
            quantity=data.quantity,
            cost_usd=data.cost_usd,
            event_metadata=data.metadata or {},
            idempotency_key=data.idempotency_key,
        )

        self.db.add(event)
        await self.db.commit()
        await self.db.refresh(event)

        return UsageEventResponse(
            success=True,
            event_id=event.id,
            customer_id=data.customer_id,
            quantity=event.quantity,
            cost_usd=event.cost_usd,
            timestamp=event.event_timestamp,
        )

    async def get_summary(
        self,
        tenant_id: UUID,
        customer_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> UsageSummary:
        from app.models.end_customer import EndCustomer

        query = select(
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
            func.count(UsageEvent.id).label("event_count"),
            func.min(UsageEvent.event_timestamp).label("start_date"),
            func.max(UsageEvent.event_timestamp).label("end_date"),
        ).where(UsageEvent.tenant_id == tenant_id)

        if customer_id:
            # Join with end_customer to filter by external_id
            query = query.join(
                EndCustomer, UsageEvent.end_customer_id == EndCustomer.id
            ).where(EndCustomer.external_id == customer_id)

        if start_date:
            query = query.where(UsageEvent.event_timestamp >= start_date)

        if end_date:
            query = query.where(UsageEvent.event_timestamp <= end_date)

        result = await self.db.execute(query)
        row = result.one()

        return UsageSummary(
            customer_id=customer_id or "all",
            total_quantity=row.total_quantity or 0,
            total_cost_usd=Decimal(str(row.total_cost or 0)),
            event_count=row.event_count or 0,
            start_date=row.start_date or datetime.utcnow(),
            end_date=row.end_date or datetime.utcnow(),
        )

    async def get_usage_by_model(self, tenant_id: UUID) -> List[ModelUsageBreakdown]:
        """Get usage breakdown by model and provider."""
        query = select(
            UsageEvent.model,
            UsageEvent.provider,
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
            func.count(UsageEvent.id).label("event_count"),
        ).where(
            UsageEvent.tenant_id == tenant_id
        ).group_by(
            UsageEvent.model, UsageEvent.provider
        ).order_by(
            func.sum(UsageEvent.cost_usd).desc()
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            ModelUsageBreakdown(
                model=row.model or "unknown",
                provider=row.provider or "unknown",
                total_quantity=row.total_quantity or 0,
                total_cost_usd=Decimal(str(row.total_cost or 0)),
                event_count=row.event_count or 0,
            )
            for row in rows
        ]

    async def get_usage_by_customer(self, tenant_id: UUID) -> List[CustomerUsageBreakdown]:
        """Get usage breakdown by customer."""
        query = select(
            EndCustomer.external_id,
            EndCustomer.name,
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
            func.count(UsageEvent.id).label("event_count"),
        ).join(
            EndCustomer, UsageEvent.end_customer_id == EndCustomer.id
        ).where(
            UsageEvent.tenant_id == tenant_id
        ).group_by(
            EndCustomer.external_id, EndCustomer.name
        ).order_by(
            func.sum(UsageEvent.cost_usd).desc()
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            CustomerUsageBreakdown(
                customer_id=row.external_id,
                customer_name=row.name,
                total_quantity=row.total_quantity or 0,
                total_cost_usd=Decimal(str(row.total_cost or 0)),
                event_count=row.event_count or 0,
            )
            for row in rows
        ]

    async def get_daily_usage(self, tenant_id: UUID, days: int = 30) -> List[DailyUsage]:
        """Get daily usage for the last N days."""
        from datetime import timedelta

        start_date = datetime.utcnow() - timedelta(days=days)

        query = select(
            cast(UsageEvent.event_timestamp, Date).label("date"),
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
            func.count(UsageEvent.id).label("event_count"),
        ).where(
            UsageEvent.tenant_id == tenant_id,
            UsageEvent.event_timestamp >= start_date
        ).group_by(
            cast(UsageEvent.event_timestamp, Date)
        ).order_by(
            cast(UsageEvent.event_timestamp, Date)
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            DailyUsage(
                date=str(row.date),
                total_quantity=row.total_quantity or 0,
                total_cost_usd=Decimal(str(row.total_cost or 0)),
                event_count=row.event_count or 0,
            )
            for row in rows
        ]

    async def get_usage_by_feature(self, tenant_id: UUID) -> List[FeatureUsageBreakdown]:
        """Get usage breakdown by feature/event_type."""
        query = select(
            UsageEvent.event_type,
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost"),
            func.count(UsageEvent.id).label("event_count"),
        ).where(
            UsageEvent.tenant_id == tenant_id
        ).group_by(
            UsageEvent.event_type
        ).order_by(
            func.sum(UsageEvent.cost_usd).desc()
        )

        result = await self.db.execute(query)
        rows = result.all()

        return [
            FeatureUsageBreakdown(
                event_type=row.event_type or "unknown",
                total_quantity=row.total_quantity or 0,
                total_cost_usd=Decimal(str(row.total_cost or 0)),
                event_count=row.event_count or 0,
            )
            for row in rows
        ]

    async def get_analytics(self, tenant_id: UUID) -> AnalyticsSummary:
        """Get comprehensive analytics summary."""
        by_model = await self.get_usage_by_model(tenant_id)
        by_customer = await self.get_usage_by_customer(tenant_id)
        by_feature = await self.get_usage_by_feature(tenant_id)
        daily_usage = await self.get_daily_usage(tenant_id)

        return AnalyticsSummary(
            by_model=by_model,
            by_customer=by_customer,
            by_feature=by_feature,
            daily_usage=daily_usage,
        )
