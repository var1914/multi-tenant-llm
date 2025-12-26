from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from uuid import UUID
from typing import List, Optional
from decimal import Decimal
from datetime import datetime, timedelta
import logging

from app.models.alert import Alert
from app.models.end_customer import EndCustomer
from app.models.usage_event import UsageEvent
from app.schemas.alerts import AlertResponse, BudgetAlertCheck

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_and_create_alerts(self, tenant_id: UUID) -> BudgetAlertCheck:
        """Check all customers for budget alerts and create alerts as needed."""
        # Get all customers with budgets
        result = await self.db.execute(
            select(EndCustomer).where(
                EndCustomer.tenant_id == tenant_id,
                EndCustomer.budget_limit_usd.isnot(None),
                EndCustomer.budget_limit_usd > 0,
                EndCustomer.budget_alert_enabled == True
            )
        )
        customers = result.scalars().all()

        alerts_created = []
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        for customer in customers:
            # Get current month's spend
            spend_result = await self.db.execute(
                select(func.sum(UsageEvent.cost_usd))
                .where(
                    UsageEvent.end_customer_id == customer.id,
                    UsageEvent.event_timestamp >= month_start
                )
            )
            current_spend = spend_result.scalar() or Decimal("0")

            budget_limit = customer.budget_limit_usd
            threshold = float(customer.budget_alert_threshold or 80)
            percentage_used = float(current_spend / budget_limit * 100) if budget_limit > 0 else 0

            # Check if we should create an alert
            alert_type = None
            message = None

            if percentage_used >= 100:
                alert_type = "budget_exceeded"
                message = f"Customer {customer.external_id} has exceeded their budget. Spend: ${current_spend:.2f} / ${budget_limit:.2f}"
            elif percentage_used >= threshold:
                alert_type = "budget_warning"
                message = f"Customer {customer.external_id} is at {percentage_used:.1f}% of their budget. Spend: ${current_spend:.2f} / ${budget_limit:.2f}"

            if alert_type:
                # Check if we already sent this type of alert today
                today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
                existing = await self.db.execute(
                    select(Alert).where(
                        Alert.tenant_id == tenant_id,
                        Alert.customer_id == customer.external_id,
                        Alert.alert_type == alert_type,
                        Alert.created_at >= today_start
                    )
                )
                if existing.scalar_one_or_none():
                    continue  # Already alerted today

                # Create alert
                alert = Alert(
                    tenant_id=tenant_id,
                    customer_id=customer.external_id,
                    alert_type=alert_type,
                    message=message,
                    threshold_percentage=percentage_used,
                    current_spend_usd=current_spend,
                    budget_limit_usd=budget_limit,
                    status="sent",
                )
                self.db.add(alert)
                await self.db.commit()
                await self.db.refresh(alert)
                alerts_created.append(alert)

                logger.info(f"Budget alert created: {message}")

        return BudgetAlertCheck(
            customers_checked=len(customers),
            alerts_triggered=len(alerts_created),
            alerts=[AlertResponse.model_validate(a) for a in alerts_created]
        )

    async def get_recent_alerts(
        self,
        tenant_id: UUID,
        days: int = 7,
        limit: int = 50
    ) -> List[AlertResponse]:
        """Get recent alerts for the tenant."""
        since = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(Alert)
            .where(
                Alert.tenant_id == tenant_id,
                Alert.created_at >= since
            )
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
        alerts = result.scalars().all()
        return [AlertResponse.model_validate(a) for a in alerts]

    async def get_alerts_for_customer(
        self,
        tenant_id: UUID,
        customer_id: str,
        limit: int = 20
    ) -> List[AlertResponse]:
        """Get alerts for a specific customer."""
        result = await self.db.execute(
            select(Alert)
            .where(
                Alert.tenant_id == tenant_id,
                Alert.customer_id == customer_id
            )
            .order_by(Alert.created_at.desc())
            .limit(limit)
        )
        alerts = result.scalars().all()
        return [AlertResponse.model_validate(a) for a in alerts]
