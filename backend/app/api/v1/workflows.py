from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field
from decimal import Decimal

from app.database import get_db
from app.services.workflow_service import WorkflowService
from app.services.workflow_guard import WorkflowCostGuard
from app.middleware.api_key_auth import get_tenant_from_api_key
from app.models.tenant import Tenant
from app.dependencies import get_current_tenant_id


router = APIRouter()


# ==================== Schemas ====================

class WorkflowStartRequest(BaseModel):
    workflow_name: str = Field(..., description="Name of the workflow")
    workflow_type: str = Field(default="sequential", description="Type: sequential, parallel, hierarchical")
    customer_id: Optional[str] = Field(None, description="Customer external_id")
    workflow_id: Optional[str] = Field(None, description="Custom workflow ID (auto-generated if not provided)")
    metadata: Optional[dict] = Field(default_factory=dict, description="Additional metadata")


class WorkflowStartResponse(BaseModel):
    workflow_id: str
    started_at: datetime
    status: str


class WorkflowStepRequest(BaseModel):
    agent_name: str = Field(..., description="Name of the agent (e.g., 'researcher', 'writer')")
    agent_type: str = Field(default="execution", description="Type: planning, execution, verification")
    llm_calls: int = Field(default=0, description="Number of LLM calls in this step")
    tool_calls: int = Field(default=0, description="Number of tool calls in this step")
    tokens_used: int = Field(default=0, description="Total tokens used in this step")
    cost_usd: float = Field(default=0.0, description="Cost in USD for this step")
    status: str = Field(default="completed", description="Step status: running, completed, failed")
    output_summary: Optional[str] = Field(None, description="Summary of step output (max 500 chars)")
    metadata: Optional[dict] = Field(default_factory=dict, description="Additional metadata")


class WorkflowStepResponse(BaseModel):
    step_number: int
    agent_name: str
    status: str
    cost_usd: float
    workflow_total_cost: float
    # Budget guard fields
    budget_exceeded: bool = False
    workflow_paused: bool = False
    budget_warning: Optional[str] = None


class WorkflowCompleteRequest(BaseModel):
    status: str = Field(default="completed", description="Final status: completed, failed")


class WorkflowCompleteResponse(BaseModel):
    workflow_id: str
    status: str
    total_steps: int
    total_cost: float
    duration_seconds: float


class WorkflowDetailResponse(BaseModel):
    id: str
    workflow_id: str
    workflow_name: Optional[str]
    workflow_type: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime]
    total_steps: int
    total_llm_calls: int
    total_tool_calls: int
    total_tokens: int
    total_cost_usd: float
    customer_id: Optional[str] = None
    steps: Optional[List[dict]] = None

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    workflows: List[WorkflowDetailResponse]
    total: int


class WorkflowAnalyticsResponse(BaseModel):
    total_workflows: int
    completed: int
    failed: int
    running: int
    success_rate: float
    avg_steps: float
    avg_cost_per_workflow: float
    total_cost: float
    total_tokens: int
    workflows: List[dict]
    agents: List[dict]


# ==================== API Key Auth Endpoints (for SDKs/integrations) ====================

@router.post("/start", response_model=WorkflowStartResponse)
async def start_workflow(
    data: WorkflowStartRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Start tracking a new agentic workflow.
    Uses API key authentication for SDK/integration use.
    """
    service = WorkflowService(db)
    try:
        workflow = await service.start_workflow(
            tenant_id=tenant.id,
            workflow_name=data.workflow_name,
            workflow_type=data.workflow_type,
            customer_id=data.customer_id,
            metadata=data.metadata,
            workflow_id=data.workflow_id,
        )
        return WorkflowStartResponse(
            workflow_id=workflow.workflow_id,
            started_at=workflow.started_at,
            status=workflow.status,
        )
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{workflow_id}/step", response_model=WorkflowStepResponse)
async def log_workflow_step(
    workflow_id: str,
    data: WorkflowStepRequest,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Log a step in an existing workflow.
    Uses API key authentication for SDK/integration use.
    Includes real-time budget checking - may pause workflow if over budget.
    """
    service = WorkflowService(db)
    cost_guard = WorkflowCostGuard(db)

    try:
        step = await service.log_step(
            tenant_id=tenant.id,
            workflow_id=workflow_id,
            agent_name=data.agent_name,
            agent_type=data.agent_type,
            llm_calls=data.llm_calls,
            tool_calls=data.tool_calls,
            tokens_used=data.tokens_used,
            cost_usd=data.cost_usd,
            status=data.status,
            output_summary=data.output_summary,
            metadata=data.metadata,
        )

        # Get updated workflow for total cost
        workflow = await service.get_workflow_by_workflow_id(tenant.id, workflow_id)

        # Check budget and apply action if needed
        guard_result = await cost_guard.check_workflow_budget(workflow.id, tenant.id)

        budget_exceeded = False
        workflow_paused = False
        budget_warning = None

        if not guard_result.within_budget:
            # Apply the budget action (pause or just alert)
            await cost_guard.apply_budget_action(workflow.id, tenant.id, guard_result)
            budget_exceeded = True
            workflow_paused = guard_result.paused
            budget_warning = guard_result.reason

        return WorkflowStepResponse(
            step_number=step.step_number,
            agent_name=step.agent_name,
            status=step.status,
            cost_usd=float(step.cost_usd),
            workflow_total_cost=float(workflow.total_cost_usd),
            budget_exceeded=budget_exceeded,
            workflow_paused=workflow_paused,
            budget_warning=budget_warning,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{workflow_id}/complete", response_model=WorkflowCompleteResponse)
async def complete_workflow(
    workflow_id: str,
    data: WorkflowCompleteRequest = WorkflowCompleteRequest(),
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Mark a workflow as complete.
    Uses API key authentication for SDK/integration use.
    """
    service = WorkflowService(db)
    try:
        workflow = await service.complete_workflow(
            tenant_id=tenant.id,
            workflow_id=workflow_id,
            status=data.status,
        )

        duration = (workflow.completed_at - workflow.started_at).total_seconds()

        return WorkflowCompleteResponse(
            workflow_id=workflow.workflow_id,
            status=workflow.status,
            total_steps=workflow.total_steps,
            total_cost=float(workflow.total_cost_usd),
            duration_seconds=duration,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/{workflow_id}/resume")
async def resume_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    tenant: Tenant = Depends(get_tenant_from_api_key)
):
    """
    Resume a paused workflow (after budget increase or override).
    Uses API key authentication for SDK/integration use.
    """
    cost_guard = WorkflowCostGuard(db)
    service = WorkflowService(db)

    # First get the workflow by workflow_id string
    workflow = await service.get_workflow_by_workflow_id(tenant.id, workflow_id)
    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    resumed = await cost_guard.resume_workflow(workflow.id, tenant.id)

    if not resumed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workflow is not paused or not found"
        )

    return {
        "workflow_id": resumed.workflow_id,
        "status": resumed.status,
        "message": "Workflow resumed successfully"
    }


# ==================== JWT Auth Endpoints (for dashboard) ====================

@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    customer_id: Optional[str] = Query(None, description="Filter by customer external_id"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(50, ge=1, le=100, description="Number of results"),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    List workflows for the dashboard.
    Uses JWT authentication.
    """
    service = WorkflowService(db)
    workflows = await service.list_workflows(
        tenant_id=tenant_id,
        customer_id=customer_id,
        status=status,
        limit=limit,
        offset=offset,
    )

    workflow_responses = [
        WorkflowDetailResponse(
            id=str(w.id),
            workflow_id=w.workflow_id,
            workflow_name=w.workflow_name,
            workflow_type=w.workflow_type,
            status=w.status,
            started_at=w.started_at,
            completed_at=w.completed_at,
            total_steps=w.total_steps,
            total_llm_calls=w.total_llm_calls,
            total_tool_calls=w.total_tool_calls,
            total_tokens=w.total_tokens,
            total_cost_usd=float(w.total_cost_usd or 0),
        )
        for w in workflows
    ]

    return WorkflowListResponse(
        workflows=workflow_responses,
        total=len(workflow_responses),
    )


@router.get("/analytics", response_model=WorkflowAnalyticsResponse)
async def get_workflow_analytics(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get workflow analytics summary for the dashboard.
    Uses JWT authentication.
    """
    service = WorkflowService(db)
    analytics = await service.get_workflow_analytics(tenant_id, days)
    return WorkflowAnalyticsResponse(**analytics)


@router.get("/{workflow_id}", response_model=WorkflowDetailResponse)
async def get_workflow_detail(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get detailed information about a specific workflow, including all steps.
    Uses JWT authentication.
    """
    service = WorkflowService(db)
    workflow = await service.get_workflow_with_steps(tenant_id, workflow_id)

    if not workflow:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workflow not found")

    steps = [
        {
            "step_number": s.step_number,
            "agent_name": s.agent_name,
            "agent_type": s.agent_type,
            "started_at": s.started_at.isoformat(),
            "completed_at": s.completed_at.isoformat() if s.completed_at else None,
            "llm_calls": s.llm_calls,
            "tool_calls": s.tool_calls,
            "tokens_used": s.tokens_used,
            "cost_usd": float(s.cost_usd),
            "status": s.status,
            "output_summary": s.output_summary,
        }
        for s in workflow.steps
    ]

    return WorkflowDetailResponse(
        id=str(workflow.id),
        workflow_id=workflow.workflow_id,
        workflow_name=workflow.workflow_name,
        workflow_type=workflow.workflow_type,
        status=workflow.status,
        started_at=workflow.started_at,
        completed_at=workflow.completed_at,
        total_steps=workflow.total_steps,
        total_llm_calls=workflow.total_llm_calls,
        total_tool_calls=workflow.total_tool_calls,
        total_tokens=workflow.total_tokens,
        total_cost_usd=float(workflow.total_cost_usd or 0),
        steps=steps,
    )
