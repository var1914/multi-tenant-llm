"""
Smart Routing API endpoints.

Provides endpoints for managing routing settings and viewing routing analytics.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timedelta

from app.database import get_db as get_async_session
from app.models.tenant import Tenant
from app.models.routing_decision import RoutingDecision
from app.dependencies import get_current_user
from app.models.user import User
from app.services.smart_router import SmartRouter, ROUTING_STRATEGIES, MODEL_TIERS, MODEL_COSTS

router = APIRouter()


# Request/Response Models
class RoutingSettingsUpdate(BaseModel):
    smart_routing_enabled: Optional[bool] = None
    routing_strategy: Optional[str] = Field(None, pattern="^(cost_optimized|balanced|quality_first|task_optimized)$")


class RoutingSettingsResponse(BaseModel):
    smart_routing_enabled: bool
    routing_strategy: str
    available_strategies: dict


class RoutingStatsResponse(BaseModel):
    period_days: int
    total_decisions: int
    routed_decisions: int
    routing_rate: float
    total_estimated_savings_usd: float
    average_complexity_score: float
    model_distribution: dict


class RoutingDecisionResponse(BaseModel):
    id: UUID
    event_timestamp: datetime
    original_model: str
    routed_model: str
    routing_applied: bool
    routing_reason: Optional[str]
    complexity_score: Optional[float]
    complexity_reasons: List[str]
    estimated_savings_usd: float
    actual_tokens: Optional[int]
    actual_cost_usd: Optional[float]
    request_id: Optional[str]

    class Config:
        from_attributes = True


class RouteRequestInput(BaseModel):
    """Input for testing routing decisions."""
    model: str
    messages: List[dict]
    customer_id: Optional[str] = None


class RouteRequestResponse(BaseModel):
    """Response from routing test."""
    original_model: str
    routed_model: str
    routing_applied: bool
    complexity_score: Optional[float]
    complexity_reasons: List[str]
    task_type: Optional[str] = None
    task_confidence: float = 0.0
    semantic_routing_used: bool = False
    routing_reason: str
    estimated_savings_usd: float


class ModelCostInfo(BaseModel):
    model: str
    provider: str
    tier: str
    input_cost_per_1m: float
    output_cost_per_1m: float


# Endpoints
@router.get("/settings", response_model=RoutingSettingsResponse)
async def get_routing_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get current routing settings for the tenant."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    return RoutingSettingsResponse(
        smart_routing_enabled=tenant.smart_routing_enabled or False,
        routing_strategy=tenant.routing_strategy or "cost_optimized",
        available_strategies=ROUTING_STRATEGIES,
    )


@router.put("/settings", response_model=RoutingSettingsResponse)
async def update_routing_settings(
    settings: RoutingSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Update routing settings for the tenant."""
    result = await db.execute(
        select(Tenant).where(Tenant.id == current_user.tenant_id)
    )
    tenant = result.scalar_one_or_none()

    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if settings.smart_routing_enabled is not None:
        tenant.smart_routing_enabled = settings.smart_routing_enabled

    if settings.routing_strategy is not None:
        if settings.routing_strategy not in ROUTING_STRATEGIES:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid strategy. Choose from: {list(ROUTING_STRATEGIES.keys())}"
            )
        tenant.routing_strategy = settings.routing_strategy

    await db.commit()
    await db.refresh(tenant)

    return RoutingSettingsResponse(
        smart_routing_enabled=tenant.smart_routing_enabled or False,
        routing_strategy=tenant.routing_strategy or "cost_optimized",
        available_strategies=ROUTING_STRATEGIES,
    )


@router.get("/stats", response_model=RoutingStatsResponse)
async def get_routing_stats(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get routing statistics for the tenant."""
    router_service = SmartRouter(db)
    stats = await router_service.get_routing_stats(current_user.tenant_id, days)
    return RoutingStatsResponse(**stats)


@router.get("/decisions", response_model=List[RoutingDecisionResponse])
async def get_routing_decisions(
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    model: Optional[str] = None,
    routed_only: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """Get recent routing decisions for the tenant."""
    query = (
        select(RoutingDecision)
        .where(RoutingDecision.tenant_id == current_user.tenant_id)
        .order_by(desc(RoutingDecision.event_timestamp))
    )

    if model:
        query = query.where(
            (RoutingDecision.original_model == model) |
            (RoutingDecision.routed_model == model)
        )

    if routed_only:
        query = query.where(RoutingDecision.routing_applied == True)

    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    decisions = result.scalars().all()

    return [
        RoutingDecisionResponse(
            id=d.id,
            event_timestamp=d.event_timestamp,
            original_model=d.original_model,
            routed_model=d.routed_model,
            routing_applied=d.routing_applied,
            routing_reason=d.routing_reason,
            complexity_score=float(d.complexity_score) if d.complexity_score else None,
            complexity_reasons=d.complexity_reasons or [],
            estimated_savings_usd=float(d.estimated_savings_usd) if d.estimated_savings_usd else 0,
            actual_tokens=d.actual_tokens,
            actual_cost_usd=float(d.actual_cost_usd) if d.actual_cost_usd else None,
            request_id=d.request_id,
        )
        for d in decisions
    ]


@router.post("/test", response_model=RouteRequestResponse)
async def test_routing(
    request: RouteRequestInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_async_session),
):
    """
    Test routing decision without recording it.

    Uses hybrid analysis combining:
    - Semantic task classification (embedding-based)
    - Keyword heuristics (fallback/supplement)

    Useful for understanding how a request would be routed.
    """
    router_service = SmartRouter(db)

    # Import analyzer
    from app.services.smart_router import ComplexityAnalyzer, ROUTING_STRATEGIES

    # Temporarily check routing without recording
    tenant = await router_service.get_tenant_settings(current_user.tenant_id)

    # Analyze using hybrid approach (semantic + keywords)
    complexity_score, complexity_reasons, task_info = ComplexityAnalyzer.analyze(
        request.messages, request.model, use_semantic=True
    )

    if not tenant or not tenant.smart_routing_enabled:
        return RouteRequestResponse(
            original_model=request.model,
            routed_model=request.model,
            routing_applied=False,
            complexity_score=complexity_score,
            complexity_reasons=complexity_reasons,
            task_type=task_info.get("task_type"),
            task_confidence=task_info.get("task_confidence", 0.0),
            semantic_routing_used=task_info.get("semantic_available", False),
            routing_reason="Routing disabled - enable to see routing decisions",
            estimated_savings_usd=0,
        )

    # Get routing decision (but don't record in test mode)
    strategy = ROUTING_STRATEGIES.get(tenant.routing_strategy, ROUTING_STRATEGIES["balanced"])
    threshold = strategy["complexity_threshold"]
    use_task_routing = strategy.get("use_task_routing", False)

    provider = router_service.get_provider_for_model(request.model)
    task_type = task_info.get("task_type", "simple")

    routed_model = request.model
    routing_applied = False
    task_str = f"[{task_type}] " if task_type else ""
    routing_reason = f"{task_str}Complexity ({complexity_score:.2f}) above threshold ({threshold})"
    estimated_savings = 0.0

    # Task-optimized routing: select best model for the task type
    if use_task_routing and task_type:
        available_models = list(MODEL_COSTS.keys())
        recommended_model, reason = router_service.get_task_optimized_model(task_type, available_models)

        if recommended_model and recommended_model.lower() != request.model.lower():
            routed_model = recommended_model
            routing_applied = True
            routing_reason = f"{task_str}Task-optimized: {reason}"
            estimated_savings = float(router_service.estimate_savings(request.model, recommended_model))
        else:
            routing_reason = f"{task_str}Already using optimal model for task"

    # Complexity-based routing (fallback when not using task routing)
    elif complexity_score < threshold:
        alternative = router_service.get_alternative_model(request.model, provider, to_premium=False)
        if alternative and alternative.lower() != request.model.lower():
            routed_model = alternative
            routing_applied = True
            routing_reason = f"{task_str}Low complexity ({complexity_score:.2f}) - would route to {alternative}"
            estimated_savings = float(router_service.estimate_savings(request.model, alternative))

    return RouteRequestResponse(
        original_model=request.model,
        routed_model=routed_model,
        routing_applied=routing_applied,
        complexity_score=complexity_score,
        complexity_reasons=complexity_reasons,
        task_type=task_info.get("task_type"),
        task_confidence=task_info.get("task_confidence", 0.0),
        semantic_routing_used=task_info.get("semantic_available", False),
        routing_reason=routing_reason,
        estimated_savings_usd=estimated_savings,
    )


@router.get("/models", response_model=List[ModelCostInfo])
async def get_supported_models(
    current_user: User = Depends(get_current_user),
):
    """Get list of supported models with cost information."""
    models = []

    for provider, tiers in MODEL_TIERS.items():
        for tier, model_list in tiers.items():
            for model in model_list:
                costs = MODEL_COSTS.get(model, {"input": 0, "output": 0})
                models.append(ModelCostInfo(
                    model=model,
                    provider=provider,
                    tier=tier,
                    input_cost_per_1m=costs["input"],
                    output_cost_per_1m=costs["output"],
                ))

    return models
