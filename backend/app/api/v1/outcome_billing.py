from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, Field

from app.database import get_db
from app.services.outcome_billing import OutcomeBillingService
from app.services.efficiency_service import EfficiencyService
from app.dependencies import get_current_tenant_id


router = APIRouter()


# ==================== Schemas ====================

class OutcomePricingRequest(BaseModel):
    workflow_type: str = Field(..., description="Type of workflow to price")
    billing_model: str = Field(..., description="Billing model: per_outcome or tiered_outcome")
    price_per_success: Optional[float] = Field(None, description="Price per successful outcome")
    free_attempts: int = Field(default=0, description="Number of free attempts before charging")
    tiers: Optional[List[dict]] = Field(None, description="Tiered pricing configuration")


class OutcomePricingResponse(BaseModel):
    id: str
    workflow_type: str
    billing_model: str
    price_per_success: Optional[float]
    free_attempts: int
    tiers: Optional[List[dict]]
    is_active: bool

    class Config:
        from_attributes = True


class InvoiceItemResponse(BaseModel):
    workflow_type: str
    successful_outcomes: int
    total_outcomes: int
    price_per_outcome: float
    free_attempts_applied: int
    billable_outcomes: int
    amount: float


class OutcomeInvoiceResponse(BaseModel):
    tenant_id: str
    start_date: date
    end_date: date
    items: List[InvoiceItemResponse]
    total_amount: float
    total_successful_outcomes: int
    total_workflows: int


class AgentMetricsResponse(BaseModel):
    agent_name: str
    total_invocations: int
    successful_invocations: int
    total_tokens: int
    total_cost: float
    avg_cost_per_call: float
    success_rate: float
    efficiency_score: int
    recommendations: List[dict]


class RecommendationResponse(BaseModel):
    agent_name: str
    type: str
    message: str
    impact: str
    potential_savings: Optional[float]


class AgentComparisonResponse(BaseModel):
    total_agents: int
    best_performer: Optional[dict]
    worst_performer: Optional[dict]
    average_efficiency: float
    total_cost: float
    agents_needing_attention: List[str]


# ==================== Outcome Pricing Endpoints ====================

@router.post("/outcome-pricing", response_model=OutcomePricingResponse)
async def configure_outcome_pricing(
    data: OutcomePricingRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Configure outcome-based pricing for a workflow type.
    """
    service = OutcomeBillingService(db)

    pricing = await service.configure_pricing(
        tenant_id=tenant_id,
        workflow_type=data.workflow_type,
        billing_model=data.billing_model,
        price_per_success=data.price_per_success,
        free_attempts=data.free_attempts,
        tiers=data.tiers,
    )

    return OutcomePricingResponse(
        id=str(pricing.id),
        workflow_type=pricing.workflow_type,
        billing_model=pricing.billing_model,
        price_per_success=float(pricing.price_per_success) if pricing.price_per_success else None,
        free_attempts=pricing.free_attempts,
        tiers=pricing.tiers,
        is_active=pricing.is_active,
    )


@router.get("/outcome-pricing", response_model=List[OutcomePricingResponse])
async def list_outcome_pricing(
    workflow_type: Optional[str] = Query(None, description="Filter by workflow type"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    List all outcome pricing configurations.
    """
    service = OutcomeBillingService(db)

    pricing_list = await service.get_pricing(
        tenant_id=tenant_id,
        workflow_type=workflow_type,
    )

    return [
        OutcomePricingResponse(
            id=str(p.id),
            workflow_type=p.workflow_type,
            billing_model=p.billing_model,
            price_per_success=float(p.price_per_success) if p.price_per_success else None,
            free_attempts=p.free_attempts,
            tiers=p.tiers,
            is_active=p.is_active,
        )
        for p in pricing_list
    ]


@router.delete("/outcome-pricing/{workflow_type}")
async def delete_outcome_pricing(
    workflow_type: str,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Deactivate outcome pricing for a workflow type.
    """
    service = OutcomeBillingService(db)

    success = await service.delete_pricing(tenant_id, workflow_type)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Pricing configuration not found"
        )

    return {"message": "Pricing configuration deactivated"}


@router.get("/outcome-invoice", response_model=OutcomeInvoiceResponse)
async def generate_outcome_invoice(
    start_date: date = Query(..., description="Invoice start date"),
    end_date: date = Query(..., description="Invoice end date"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Generate an outcome-based invoice for the specified period.
    """
    service = OutcomeBillingService(db)

    invoice = await service.generate_outcome_invoice(
        tenant_id=tenant_id,
        start_date=start_date,
        end_date=end_date,
    )

    return OutcomeInvoiceResponse(
        tenant_id=invoice.tenant_id,
        start_date=invoice.start_date,
        end_date=invoice.end_date,
        items=[
            InvoiceItemResponse(
                workflow_type=item.workflow_type,
                successful_outcomes=item.successful_outcomes,
                total_outcomes=item.total_outcomes,
                price_per_outcome=item.price_per_outcome,
                free_attempts_applied=item.free_attempts_applied,
                billable_outcomes=item.billable_outcomes,
                amount=item.amount,
            )
            for item in invoice.items
        ],
        total_amount=invoice.total_amount,
        total_successful_outcomes=invoice.total_successful_outcomes,
        total_workflows=invoice.total_workflows,
    )


# ==================== Agent Efficiency Endpoints ====================

@router.get("/efficiency/agents", response_model=List[AgentMetricsResponse])
async def get_agent_efficiency(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get efficiency metrics for all agents.
    """
    service = EfficiencyService(db)

    agents = await service.calculate_agent_efficiency(tenant_id, days)

    return [
        AgentMetricsResponse(
            agent_name=a.agent_name,
            total_invocations=a.total_invocations,
            successful_invocations=a.successful_invocations,
            total_tokens=a.total_tokens,
            total_cost=a.total_cost,
            avg_cost_per_call=a.avg_cost_per_call,
            success_rate=a.success_rate,
            efficiency_score=a.efficiency_score,
            recommendations=a.recommendations,
        )
        for a in agents
    ]


@router.get("/efficiency/recommendations", response_model=List[RecommendationResponse])
async def get_optimization_recommendations(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get optimization recommendations across all agents.
    Sorted by impact and potential savings.
    """
    service = EfficiencyService(db)

    recommendations = await service.get_optimization_recommendations(tenant_id, days)

    return [
        RecommendationResponse(
            agent_name=r.agent_name,
            type=r.type,
            message=r.message,
            impact=r.impact,
            potential_savings=r.potential_savings,
        )
        for r in recommendations
    ]


@router.get("/efficiency/comparison", response_model=AgentComparisonResponse)
async def get_agent_comparison(
    days: int = Query(30, ge=1, le=365, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get a comparison summary of all agents.
    Shows best/worst performers and agents needing attention.
    """
    service = EfficiencyService(db)

    comparison = await service.get_agent_comparison(tenant_id, days)

    return AgentComparisonResponse(**comparison)
