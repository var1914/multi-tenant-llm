from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timedelta
import logging

from app.models.tenant import Tenant
from app.models.pricing_plan import PricingPlan
from app.models.billing_period import BillingPeriod
from app.models.usage_event import UsageEvent
from app.schemas.billing import BillingPeriodResponse, CurrentUsageResponse

logger = logging.getLogger(__name__)


class BillingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_current_period(self, tenant_id: UUID) -> BillingPeriod:
        """
        Get the current billing period or create one if it doesn't exist.
        Billing periods are monthly, starting on the 1st of each month.
        """
        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Calculate period end (first of next month)
        if now.month == 12:
            period_end = period_start.replace(year=now.year + 1, month=1)
        else:
            period_end = period_start.replace(month=now.month + 1)

        # Check for existing period
        result = await self.db.execute(
            select(BillingPeriod).where(
                BillingPeriod.tenant_id == tenant_id,
                BillingPeriod.period_start == period_start
            )
        )
        period = result.scalar_one_or_none()

        if period:
            return period

        # Get tenant's current plan
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            raise ValueError("Tenant not found")

        # Get plan details
        plan = None
        if tenant.current_plan_id:
            plan_result = await self.db.execute(
                select(PricingPlan).where(PricingPlan.id == tenant.current_plan_id)
            )
            plan = plan_result.scalar_one_or_none()

        # Use defaults if no plan
        included_tokens = plan.included_tokens if plan else 1000000
        base_cost = plan.price_monthly_usd if plan else Decimal("0")

        # Create new billing period
        period = BillingPeriod(
            tenant_id=tenant_id,
            period_start=period_start,
            period_end=period_end,
            status="active",
            included_tokens=included_tokens,
            base_cost_usd=base_cost,
            total_cost_usd=base_cost,
        )
        self.db.add(period)
        await self.db.commit()
        await self.db.refresh(period)

        logger.info(f"Created billing period for tenant {tenant_id}: {period_start} to {period_end}")
        return period

    async def update_period_usage(self, tenant_id: UUID) -> BillingPeriod:
        """
        Update the current billing period with actual usage data.
        Should be called periodically or when usage is tracked.
        """
        period = await self.get_or_create_current_period(tenant_id)

        # Calculate total tokens used in this period
        result = await self.db.execute(
            select(func.sum(UsageEvent.quantity)).where(
                UsageEvent.tenant_id == tenant_id,
                UsageEvent.event_timestamp >= period.period_start,
                UsageEvent.event_timestamp < period.period_end
            )
        )
        total_tokens = result.scalar() or 0

        # Get tenant's plan for overage pricing
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()

        overage_rate = Decimal("0.002")  # Default rate per 1k tokens
        if tenant and tenant.current_plan_id:
            plan_result = await self.db.execute(
                select(PricingPlan).where(PricingPlan.id == tenant.current_plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            if plan:
                overage_rate = plan.overage_price_per_1k_tokens

        # Calculate overage
        overage_tokens = max(0, total_tokens - period.included_tokens)
        overage_cost = Decimal(overage_tokens / 1000) * overage_rate

        # Update period
        period.total_tokens_used = total_tokens
        period.overage_tokens = overage_tokens
        period.overage_cost_usd = overage_cost
        period.total_cost_usd = period.base_cost_usd + overage_cost

        await self.db.commit()
        await self.db.refresh(period)

        return period

    async def get_current_usage(self, tenant_id: UUID) -> CurrentUsageResponse:
        """
        Get current usage summary for the active billing period.
        """
        period = await self.update_period_usage(tenant_id)

        # Get tenant's current plan
        tenant_result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()

        plan_name = "Free"
        plan_base_cost = Decimal("0")

        if tenant and tenant.current_plan_id:
            plan_result = await self.db.execute(
                select(PricingPlan).where(PricingPlan.id == tenant.current_plan_id)
            )
            plan = plan_result.scalar_one_or_none()
            if plan:
                plan_name = plan.name
                plan_base_cost = plan.price_monthly_usd

        tokens_remaining = max(0, period.included_tokens - period.total_tokens_used)

        return CurrentUsageResponse(
            period_start=period.period_start,
            period_end=period.period_end,
            tokens_used=period.total_tokens_used,
            tokens_included=period.included_tokens,
            tokens_remaining=tokens_remaining,
            overage_tokens=period.overage_tokens,
            estimated_overage_cost=period.overage_cost_usd,
            plan_name=plan_name,
            plan_base_cost=plan_base_cost,
        )

    async def close_billing_period(self, tenant_id: UUID, period_id: UUID) -> BillingPeriod:
        """
        Close a billing period and mark it ready for invoicing.
        This should be called at the end of each billing cycle.
        """
        result = await self.db.execute(
            select(BillingPeriod).where(
                BillingPeriod.id == period_id,
                BillingPeriod.tenant_id == tenant_id
            )
        )
        period = result.scalar_one_or_none()
        if not period:
            raise ValueError("Billing period not found")

        if period.status != "active":
            raise ValueError(f"Cannot close period with status: {period.status}")

        # Update final usage
        await self.update_period_usage(tenant_id)

        # Close the period
        period.status = "closed"
        await self.db.commit()
        await self.db.refresh(period)

        logger.info(f"Closed billing period {period_id} for tenant {tenant_id}")
        return period

    async def get_billing_history(
        self,
        tenant_id: UUID,
        limit: int = 12
    ) -> List[BillingPeriodResponse]:
        """
        Get past billing periods for a tenant.
        """
        result = await self.db.execute(
            select(BillingPeriod)
            .where(BillingPeriod.tenant_id == tenant_id)
            .order_by(BillingPeriod.period_start.desc())
            .limit(limit)
        )
        periods = result.scalars().all()
        return [BillingPeriodResponse.model_validate(p) for p in periods]

    async def process_end_of_period(self, tenant_id: UUID):
        """
        Process end of billing period:
        1. Close current period
        2. Create invoice (via Stripe)
        3. Create new period

        This should be called by a scheduled job at the end of each month.
        """
        now = datetime.utcnow()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # Get current active period
        result = await self.db.execute(
            select(BillingPeriod).where(
                BillingPeriod.tenant_id == tenant_id,
                BillingPeriod.status == "active"
            )
        )
        active_period = result.scalar_one_or_none()

        if active_period and active_period.period_start < period_start:
            # Period has ended, close it
            await self.close_billing_period(tenant_id, active_period.id)

            # Create new period for current month
            await self.get_or_create_current_period(tenant_id)

            logger.info(f"Processed end of billing period for tenant {tenant_id}")
