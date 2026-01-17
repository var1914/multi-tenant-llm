from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from sqlalchemy.orm import selectinload
from uuid import UUID, uuid4
from datetime import datetime, timedelta
from typing import Optional, List
from decimal import Decimal

from app.models.agent_workflow import AgentWorkflow
from app.models.workflow_step import WorkflowStep
from app.models.end_customer import EndCustomer
from app.services.customer_service import CustomerService


class WorkflowService:
    """Service for managing agentic AI workflows."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.customer_service = CustomerService(db)

    async def start_workflow(
        self,
        tenant_id: UUID,
        workflow_name: str,
        workflow_type: str = "sequential",
        customer_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        workflow_id: Optional[str] = None,
    ) -> AgentWorkflow:
        """Start tracking a new agentic workflow."""

        # Generate workflow_id if not provided
        if not workflow_id:
            workflow_id = str(uuid4())

        # Get or create customer if customer_id provided
        end_customer = None
        if customer_id:
            end_customer = await self.customer_service.get_or_create(tenant_id, customer_id)

        workflow = AgentWorkflow(
            tenant_id=tenant_id,
            end_customer_id=end_customer.id if end_customer else None,
            workflow_id=workflow_id,
            workflow_name=workflow_name,
            workflow_type=workflow_type,
            status="running",
            started_at=datetime.utcnow(),
            metadata=metadata or {},
        )

        self.db.add(workflow)
        await self.db.commit()
        await self.db.refresh(workflow)

        return workflow

    async def log_step(
        self,
        tenant_id: UUID,
        workflow_id: str,
        agent_name: str,
        agent_type: str = "execution",
        llm_calls: int = 0,
        tool_calls: int = 0,
        tokens_used: int = 0,
        cost_usd: float = 0.0,
        status: str = "completed",
        output_summary: Optional[str] = None,
        metadata: Optional[dict] = None,
    ) -> WorkflowStep:
        """Log a single step in the workflow."""

        # Get the workflow
        workflow = await self.get_workflow_by_workflow_id(tenant_id, workflow_id)
        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")

        if workflow.status not in ["running"]:
            raise ValueError(f"Cannot add steps to workflow with status: {workflow.status}")

        # Get current max step number
        result = await self.db.execute(
            select(func.max(WorkflowStep.step_number))
            .where(WorkflowStep.workflow_id == workflow.id)
        )
        max_step = result.scalar() or 0

        # Create the step
        step = WorkflowStep(
            tenant_id=tenant_id,
            workflow_id=workflow.id,
            step_number=max_step + 1,
            agent_name=agent_name,
            agent_type=agent_type,
            started_at=datetime.utcnow(),
            completed_at=datetime.utcnow(),
            llm_calls=llm_calls,
            tool_calls=tool_calls,
            tokens_used=tokens_used,
            cost_usd=Decimal(str(cost_usd)),
            status=status,
            output_summary=output_summary[:500] if output_summary else None,
            metadata=metadata or {},
        )

        self.db.add(step)

        # Update workflow totals
        workflow.total_steps += 1
        workflow.total_llm_calls += llm_calls
        workflow.total_tool_calls += tool_calls
        workflow.total_tokens += tokens_used
        workflow.total_cost_usd = Decimal(str(workflow.total_cost_usd or 0)) + Decimal(str(cost_usd))

        await self.db.commit()
        await self.db.refresh(step)

        return step

    async def complete_workflow(
        self,
        tenant_id: UUID,
        workflow_id: str,
        status: str = "completed",
    ) -> AgentWorkflow:
        """Mark a workflow as complete."""

        workflow = await self.get_workflow_by_workflow_id(tenant_id, workflow_id)
        if not workflow:
            raise ValueError(f"Workflow not found: {workflow_id}")

        workflow.status = status
        workflow.completed_at = datetime.utcnow()

        await self.db.commit()
        await self.db.refresh(workflow)

        return workflow

    async def get_workflow_by_workflow_id(
        self,
        tenant_id: UUID,
        workflow_id: str,
    ) -> Optional[AgentWorkflow]:
        """Get a workflow by its workflow_id (not database id)."""

        result = await self.db.execute(
            select(AgentWorkflow)
            .where(
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.workflow_id == workflow_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_workflow_with_steps(
        self,
        tenant_id: UUID,
        workflow_id: str,
    ) -> Optional[AgentWorkflow]:
        """Get a workflow with all its steps loaded."""

        result = await self.db.execute(
            select(AgentWorkflow)
            .options(selectinload(AgentWorkflow.steps))
            .where(
                AgentWorkflow.tenant_id == tenant_id,
                AgentWorkflow.workflow_id == workflow_id,
            )
        )
        return result.scalar_one_or_none()

    async def list_workflows(
        self,
        tenant_id: UUID,
        customer_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[AgentWorkflow]:
        """List workflows for a tenant."""

        query = select(AgentWorkflow).where(AgentWorkflow.tenant_id == tenant_id)

        if customer_id:
            # Join with EndCustomer to filter by external_id
            query = query.join(
                EndCustomer, AgentWorkflow.end_customer_id == EndCustomer.id
            ).where(EndCustomer.external_id == customer_id)

        if status:
            query = query.where(AgentWorkflow.status == status)

        query = query.order_by(desc(AgentWorkflow.started_at)).limit(limit).offset(offset)

        result = await self.db.execute(query)
        return list(result.scalars().all())

    async def get_workflow_analytics(
        self,
        tenant_id: UUID,
        days: int = 30,
    ) -> dict:
        """Get workflow analytics summary."""

        start_date = datetime.utcnow() - timedelta(days=days)

        # Total workflows and status breakdown
        total_query = select(
            func.count(AgentWorkflow.id).label("total_workflows"),
            func.count(AgentWorkflow.id).filter(AgentWorkflow.status == "completed").label("completed"),
            func.count(AgentWorkflow.id).filter(AgentWorkflow.status == "failed").label("failed"),
            func.count(AgentWorkflow.id).filter(AgentWorkflow.status == "running").label("running"),
            func.avg(AgentWorkflow.total_steps).label("avg_steps"),
            func.avg(AgentWorkflow.total_cost_usd).label("avg_cost"),
            func.sum(AgentWorkflow.total_cost_usd).label("total_cost"),
            func.sum(AgentWorkflow.total_tokens).label("total_tokens"),
        ).where(
            AgentWorkflow.tenant_id == tenant_id,
            AgentWorkflow.started_at >= start_date,
        )

        result = await self.db.execute(total_query)
        row = result.one()

        total_workflows = row.total_workflows or 0
        completed = row.completed or 0
        success_rate = (completed / total_workflows * 100) if total_workflows > 0 else 0

        # Top workflows by cost
        top_workflows_query = select(
            AgentWorkflow.workflow_name,
            AgentWorkflow.workflow_type,
            func.count(AgentWorkflow.id).label("count"),
            func.avg(AgentWorkflow.total_steps).label("avg_steps"),
            func.avg(AgentWorkflow.total_cost_usd).label("avg_cost"),
            func.sum(AgentWorkflow.total_cost_usd).label("total_cost"),
        ).where(
            AgentWorkflow.tenant_id == tenant_id,
            AgentWorkflow.started_at >= start_date,
        ).group_by(
            AgentWorkflow.workflow_name,
            AgentWorkflow.workflow_type,
        ).order_by(
            desc(func.sum(AgentWorkflow.total_cost_usd))
        ).limit(10)

        top_workflows_result = await self.db.execute(top_workflows_query)
        top_workflows = [
            {
                "name": r.workflow_name or "Unnamed",
                "type": r.workflow_type,
                "count": r.count,
                "avg_steps": float(r.avg_steps or 0),
                "avg_cost": float(r.avg_cost or 0),
                "total_cost": float(r.total_cost or 0),
            }
            for r in top_workflows_result.all()
        ]

        # Agent performance breakdown
        agent_query = select(
            WorkflowStep.agent_name,
            WorkflowStep.agent_type,
            func.count(WorkflowStep.id).label("invocations"),
            func.count(WorkflowStep.id).filter(WorkflowStep.status == "completed").label("successful"),
            func.avg(WorkflowStep.tokens_used).label("avg_tokens"),
            func.avg(WorkflowStep.cost_usd).label("avg_cost"),
            func.sum(WorkflowStep.cost_usd).label("total_cost"),
        ).where(
            WorkflowStep.tenant_id == tenant_id,
            WorkflowStep.created_at >= start_date,
        ).group_by(
            WorkflowStep.agent_name,
            WorkflowStep.agent_type,
        ).order_by(
            desc(func.sum(WorkflowStep.cost_usd))
        ).limit(10)

        agent_result = await self.db.execute(agent_query)
        agents = [
            {
                "name": r.agent_name,
                "type": r.agent_type,
                "invocations": r.invocations,
                "success_rate": (r.successful / r.invocations * 100) if r.invocations > 0 else 0,
                "avg_tokens": int(r.avg_tokens or 0),
                "avg_cost": float(r.avg_cost or 0),
                "total_cost": float(r.total_cost or 0),
            }
            for r in agent_result.all()
        ]

        return {
            "total_workflows": total_workflows,
            "completed": completed,
            "failed": row.failed or 0,
            "running": row.running or 0,
            "success_rate": round(success_rate, 1),
            "avg_steps": float(row.avg_steps or 0),
            "avg_cost_per_workflow": float(row.avg_cost or 0),
            "total_cost": float(row.total_cost or 0),
            "total_tokens": int(row.total_tokens or 0),
            "workflows": top_workflows,
            "agents": agents,
        }
