from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from uuid import UUID
from typing import Optional, List
from decimal import Decimal
from datetime import datetime, timedelta

from app.models.end_customer import EndCustomer
from app.models.usage_event import UsageEvent
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerBudgetStatus


class CustomerService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, tenant_id: UUID, data: CustomerCreate) -> EndCustomer:
        # Check if customer with external_id already exists
        existing = await self.get_by_external_id(tenant_id, data.external_id)
        if existing:
            raise ValueError(f"Customer with external_id '{data.external_id}' already exists")

        customer = EndCustomer(
            tenant_id=tenant_id,
            external_id=data.external_id,
            name=data.name,
            email=data.email,
            customer_metadata=data.metadata or {},
            budget_limit_usd=data.budget_limit_usd,
            budget_alert_threshold=data.budget_alert_threshold,
            budget_alert_enabled=data.budget_alert_enabled,
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def get_by_id(self, tenant_id: UUID, customer_id: UUID) -> Optional[EndCustomer]:
        result = await self.db.execute(
            select(EndCustomer).where(
                EndCustomer.id == customer_id,
                EndCustomer.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def get_by_external_id(self, tenant_id: UUID, external_id: str) -> Optional[EndCustomer]:
        result = await self.db.execute(
            select(EndCustomer).where(
                EndCustomer.external_id == external_id,
                EndCustomer.tenant_id == tenant_id
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create(self, tenant_id: UUID, external_id: str) -> EndCustomer:
        """Get existing customer or create a new one."""
        customer = await self.get_by_external_id(tenant_id, external_id)
        if customer:
            return customer

        customer = EndCustomer(
            tenant_id=tenant_id,
            external_id=external_id,
            customer_metadata={},
        )
        self.db.add(customer)
        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def list_all(self, tenant_id: UUID, skip: int = 0, limit: int = 100) -> List[EndCustomer]:
        result = await self.db.execute(
            select(EndCustomer)
            .where(EndCustomer.tenant_id == tenant_id)
            .order_by(EndCustomer.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def count(self, tenant_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(EndCustomer.id))
            .where(EndCustomer.tenant_id == tenant_id)
        )
        return result.scalar() or 0

    async def update(self, tenant_id: UUID, customer_id: UUID, data: CustomerUpdate) -> Optional[EndCustomer]:
        customer = await self.get_by_id(tenant_id, customer_id)
        if not customer:
            return None

        if data.name is not None:
            customer.name = data.name
        if data.email is not None:
            customer.email = data.email
        if data.metadata is not None:
            customer.customer_metadata = data.metadata
        if data.budget_limit_usd is not None:
            customer.budget_limit_usd = data.budget_limit_usd
        if data.budget_alert_threshold is not None:
            customer.budget_alert_threshold = data.budget_alert_threshold
        if data.budget_alert_enabled is not None:
            customer.budget_alert_enabled = data.budget_alert_enabled

        await self.db.commit()
        await self.db.refresh(customer)
        return customer

    async def delete(self, tenant_id: UUID, customer_id: UUID) -> bool:
        customer = await self.get_by_id(tenant_id, customer_id)
        if not customer:
            return False

        await self.db.delete(customer)
        await self.db.commit()
        return True

    async def get_budget_status(self, tenant_id: UUID, customer_id: UUID) -> Optional[CustomerBudgetStatus]:
        """Get the current month's budget status for a customer."""
        customer = await self.get_by_id(tenant_id, customer_id)
        if not customer:
            return None

        # Get current month's spend
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        result = await self.db.execute(
            select(func.sum(UsageEvent.cost_usd))
            .where(
                UsageEvent.end_customer_id == customer.id,
                UsageEvent.event_timestamp >= month_start
            )
        )
        current_spend = result.scalar() or Decimal("0")

        budget_limit = customer.budget_limit_usd or Decimal("0")
        threshold = float(customer.budget_alert_threshold or 80)

        if budget_limit > 0:
            percentage_used = float(current_spend / budget_limit * 100)
        else:
            percentage_used = 0

        return CustomerBudgetStatus(
            customer_id=customer.external_id,
            customer_name=customer.name,
            budget_limit_usd=budget_limit if budget_limit > 0 else None,
            current_spend_usd=current_spend,
            percentage_used=round(percentage_used, 2),
            is_over_budget=percentage_used >= 100 if budget_limit > 0 else False,
            is_near_threshold=percentage_used >= threshold if budget_limit > 0 else False,
        )

    async def get_all_budget_statuses(self, tenant_id: UUID) -> List[CustomerBudgetStatus]:
        """Get budget status for all customers with budgets set."""
        customers = await self.list_all(tenant_id, limit=1000)
        statuses = []

        for customer in customers:
            if customer.budget_limit_usd and customer.budget_limit_usd > 0:
                status = await self.get_budget_status(tenant_id, customer.id)
                if status:
                    statuses.append(status)

        # Sort by percentage used (highest first)
        statuses.sort(key=lambda x: x.percentage_used, reverse=True)
        return statuses
