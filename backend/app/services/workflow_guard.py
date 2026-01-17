from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from typing import Optional
from uuid import UUID
from decimal import Decimal
from dataclasses import dataclass
from datetime import datetime

from app.models.agent_workflow import AgentWorkflow
from app.models.end_customer import EndCustomer


@dataclass
class CostGuardResult:
    """Result of a budget check."""
    within_budget: bool
    paused: bool
    reason: Optional[str]
    current_cost: float
    budget: Optional[float]
    budget_action: str
    percentage_used: Optional[float]


class WorkflowCostGuard:
    """
    Service for checking workflow costs against customer budgets.
    Implements real-time cost guards for agentic AI workflows.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def check_workflow_budget(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
    ) -> CostGuardResult:
        """
        Check if a workflow is within its customer's budget.

        Returns:
            CostGuardResult with budget status and whether workflow should be paused
        """
        # Get workflow with customer info
        result = await self.db.execute(
            select(AgentWorkflow)
            .options(selectinload(AgentWorkflow.end_customer))
            .where(
                AgentWorkflow.id == workflow_id,
                AgentWorkflow.tenant_id == tenant_id
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            return CostGuardResult(
                within_budget=True,
                paused=False,
                reason="Workflow not found",
                current_cost=0,
                budget=None,
                budget_action='alert',
                percentage_used=None
            )

        current_cost = float(workflow.total_cost_usd or 0)

        # If no customer associated, no budget to check
        if not workflow.end_customer:
            return CostGuardResult(
                within_budget=True,
                paused=False,
                reason=None,
                current_cost=current_cost,
                budget=None,
                budget_action='alert',
                percentage_used=None
            )

        customer = workflow.end_customer
        workflow_budget = customer.workflow_budget_usd
        budget_action = customer.workflow_budget_action or 'alert'

        # If no workflow budget set, no limit
        if workflow_budget is None:
            return CostGuardResult(
                within_budget=True,
                paused=False,
                reason=None,
                current_cost=current_cost,
                budget=None,
                budget_action=budget_action,
                percentage_used=None
            )

        budget_float = float(workflow_budget)
        percentage_used = (current_cost / budget_float * 100) if budget_float > 0 else 0

        # Check if over budget
        if current_cost >= budget_float:
            should_pause = budget_action == 'pause'

            return CostGuardResult(
                within_budget=False,
                paused=should_pause,
                reason=f"Workflow exceeded budget (${current_cost:.4f} / ${budget_float:.4f})",
                current_cost=current_cost,
                budget=budget_float,
                budget_action=budget_action,
                percentage_used=percentage_used
            )

        return CostGuardResult(
            within_budget=True,
            paused=False,
            reason=None,
            current_cost=current_cost,
            budget=budget_float,
            budget_action=budget_action,
            percentage_used=percentage_used
        )

    async def apply_budget_action(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
        guard_result: CostGuardResult,
    ) -> AgentWorkflow:
        """
        Apply the budget action to the workflow if needed.
        Updates workflow status to 'paused_over_budget' if action is 'pause'.
        """
        if not guard_result.paused:
            # Just mark budget exceeded flag
            await self.db.execute(
                update(AgentWorkflow)
                .where(
                    AgentWorkflow.id == workflow_id,
                    AgentWorkflow.tenant_id == tenant_id
                )
                .values(
                    budget_exceeded=not guard_result.within_budget,
                    budget_alert_sent=not guard_result.within_budget
                )
            )
        else:
            # Pause the workflow
            await self.db.execute(
                update(AgentWorkflow)
                .where(
                    AgentWorkflow.id == workflow_id,
                    AgentWorkflow.tenant_id == tenant_id
                )
                .values(
                    status='paused_over_budget',
                    budget_exceeded=True,
                    budget_alert_sent=True
                )
            )

        await self.db.commit()

        # Return updated workflow
        result = await self.db.execute(
            select(AgentWorkflow).where(AgentWorkflow.id == workflow_id)
        )
        return result.scalar_one()

    async def resume_workflow(
        self,
        workflow_id: UUID,
        tenant_id: UUID,
    ) -> Optional[AgentWorkflow]:
        """
        Resume a paused workflow (e.g., after budget increase).
        """
        result = await self.db.execute(
            select(AgentWorkflow)
            .where(
                AgentWorkflow.id == workflow_id,
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.status == 'paused_over_budget'
            )
        )
        workflow = result.scalar_one_or_none()

        if not workflow:
            return None

        workflow.status = 'running'
        workflow.budget_exceeded = False
        await self.db.commit()
        await self.db.refresh(workflow)

        return workflow

    async def get_budget_status(
        self,
        tenant_id: UUID,
        customer_external_id: str,
    ) -> dict:
        """
        Get overall budget status for a customer's workflows.
        """
        # Get customer
        result = await self.db.execute(
            select(EndCustomer)
            .where(
                EndCustomer.tenant_id == tenant_id,
                EndCustomer.external_id == customer_external_id
            )
        )
        customer = result.scalar_one_or_none()

        if not customer:
            return {"error": "Customer not found"}

        # Get active workflows for this customer
        workflows_result = await self.db.execute(
            select(AgentWorkflow)
            .where(
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.end_customer_id == customer.id,
                AgentWorkflow.status.in_(['running', 'paused_over_budget'])
            )
        )
        workflows = workflows_result.scalars().all()

        total_active_cost = sum(float(w.total_cost_usd or 0) for w in workflows)
        paused_count = sum(1 for w in workflows if w.status == 'paused_over_budget')

        return {
            "customer_id": customer.external_id,
            "workflow_budget_usd": float(customer.workflow_budget_usd) if customer.workflow_budget_usd else None,
            "workflow_budget_action": customer.workflow_budget_action,
            "active_workflows": len(workflows),
            "paused_workflows": paused_count,
            "total_active_cost": total_active_cost,
        }
