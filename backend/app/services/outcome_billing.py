from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional, List
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date
from dataclasses import dataclass

from app.models.outcome_pricing import OutcomePricing
from app.models.agent_workflow import AgentWorkflow
from app.models.tenant import Tenant


@dataclass
class OutcomeInvoiceItem:
    """Single line item in an outcome-based invoice."""
    workflow_type: str
    successful_outcomes: int
    total_outcomes: int
    price_per_outcome: float
    free_attempts_applied: int
    billable_outcomes: int
    amount: float


@dataclass
class OutcomeInvoice:
    """Full outcome-based invoice for a period."""
    tenant_id: str
    start_date: date
    end_date: date
    items: List[OutcomeInvoiceItem]
    total_amount: float
    total_successful_outcomes: int
    total_workflows: int


class OutcomeBillingService:
    """
    Service for outcome-based billing.
    Bills customers based on successful workflow completions rather than token usage.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def configure_pricing(
        self,
        tenant_id: UUID,
        workflow_type: str,
        billing_model: str,
        price_per_success: Optional[float] = None,
        free_attempts: int = 0,
        tiers: Optional[list] = None,
    ) -> OutcomePricing:
        """
        Configure or update outcome pricing for a workflow type.
        """
        # Check if pricing already exists
        result = await self.db.execute(
            select(OutcomePricing).where(
                OutcomePricing.tenant_id == tenant_id,
                OutcomePricing.workflow_type == workflow_type
            )
        )
        pricing = result.scalar_one_or_none()

        if pricing:
            # Update existing
            pricing.billing_model = billing_model
            pricing.price_per_success = Decimal(str(price_per_success)) if price_per_success else None
            pricing.free_attempts = free_attempts
            pricing.tiers = tiers or []
            pricing.is_active = True
        else:
            # Create new
            pricing = OutcomePricing(
                tenant_id=tenant_id,
                workflow_type=workflow_type,
                billing_model=billing_model,
                price_per_success=Decimal(str(price_per_success)) if price_per_success else None,
                free_attempts=free_attempts,
                tiers=tiers or [],
            )
            self.db.add(pricing)

        await self.db.commit()
        await self.db.refresh(pricing)
        return pricing

    async def get_pricing(
        self,
        tenant_id: UUID,
        workflow_type: Optional[str] = None,
    ) -> List[OutcomePricing]:
        """
        Get outcome pricing configurations.
        """
        query = select(OutcomePricing).where(
            OutcomePricing.tenant_id == tenant_id,
            OutcomePricing.is_active == True
        )

        if workflow_type:
            query = query.where(OutcomePricing.workflow_type == workflow_type)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def delete_pricing(
        self,
        tenant_id: UUID,
        workflow_type: str,
    ) -> bool:
        """
        Deactivate outcome pricing for a workflow type.
        """
        result = await self.db.execute(
            select(OutcomePricing).where(
                OutcomePricing.tenant_id == tenant_id,
                OutcomePricing.workflow_type == workflow_type
            )
        )
        pricing = result.scalar_one_or_none()

        if pricing:
            pricing.is_active = False
            await self.db.commit()
            return True

        return False

    async def generate_outcome_invoice(
        self,
        tenant_id: UUID,
        start_date: date,
        end_date: date,
    ) -> OutcomeInvoice:
        """
        Generate an outcome-based invoice for the specified period.
        Only bills for successful workflow completions.
        """
        # Get all pricing rules
        pricing_result = await self.db.execute(
            select(OutcomePricing).where(
                OutcomePricing.tenant_id == tenant_id,
                OutcomePricing.is_active == True
            )
        )
        pricing_rules = {p.workflow_type: p for p in pricing_result.scalars().all()}

        # Get workflow outcomes by type
        workflows_result = await self.db.execute(
            select(
                AgentWorkflow.workflow_type,
                func.count(AgentWorkflow.id).label('total'),
                func.count(AgentWorkflow.id).filter(AgentWorkflow.status == 'completed').label('successful')
            )
            .where(
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.completed_at >= datetime.combine(start_date, datetime.min.time()),
                AgentWorkflow.completed_at < datetime.combine(end_date, datetime.max.time()),
                AgentWorkflow.status.in_(['completed', 'failed'])
            )
            .group_by(AgentWorkflow.workflow_type)
        )

        items = []
        total_amount = 0.0
        total_successful = 0
        total_workflows = 0

        for row in workflows_result:
            workflow_type = row.workflow_type
            total = row.total
            successful = row.successful

            total_workflows += total
            total_successful += successful

            # Check if we have pricing for this workflow type
            pricing = pricing_rules.get(workflow_type)

            if pricing:
                # Calculate price using pricing model
                free_applied = min(successful, pricing.free_attempts)
                billable = max(0, successful - pricing.free_attempts)
                amount = pricing.calculate_price(successful, total)

                items.append(OutcomeInvoiceItem(
                    workflow_type=workflow_type,
                    successful_outcomes=successful,
                    total_outcomes=total,
                    price_per_outcome=float(pricing.price_per_success or 0),
                    free_attempts_applied=free_applied,
                    billable_outcomes=billable,
                    amount=amount,
                ))
                total_amount += amount
            else:
                # No pricing configured - show in invoice but $0
                items.append(OutcomeInvoiceItem(
                    workflow_type=workflow_type,
                    successful_outcomes=successful,
                    total_outcomes=total,
                    price_per_outcome=0,
                    free_attempts_applied=0,
                    billable_outcomes=0,
                    amount=0,
                ))

        return OutcomeInvoice(
            tenant_id=str(tenant_id),
            start_date=start_date,
            end_date=end_date,
            items=items,
            total_amount=total_amount,
            total_successful_outcomes=total_successful,
            total_workflows=total_workflows,
        )

    async def calculate_workflow_price(
        self,
        tenant_id: UUID,
        workflow_id: str,
    ) -> Optional[float]:
        """
        Calculate the price for a specific workflow based on outcome pricing.
        Returns None if no pricing is configured.
        """
        # Get workflow
        result = await self.db.execute(
            select(AgentWorkflow).where(
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.workflow_id == workflow_id
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            return None

        # Get pricing for this workflow type
        pricing_result = await self.db.execute(
            select(OutcomePricing).where(
                OutcomePricing.tenant_id == tenant_id,
                OutcomePricing.workflow_type == workflow.workflow_type,
                OutcomePricing.is_active == True
            )
        )
        pricing = pricing_result.scalar_one_or_none()

        if not pricing:
            return None

        # Only charge for successful workflows
        if workflow.status == 'completed':
            return float(pricing.price_per_success or 0)

        return 0.0
