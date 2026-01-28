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
from app.services.routellm_service import is_routellm_available, get_routellm_service, get_routellm_status

router = APIRouter()


# Request/Response Models
class RoutingSettingsUpdate(BaseModel):
    smart_routing_enabled: Optional[bool] = None
    routing_strategy: Optional[str] = Field(None, pattern="^(cost_optimized|quality_first)$")
    # RouteLLM settings
    routellm_enabled: Optional[bool] = None
    routellm_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    cascade_routing_enabled: Optional[bool] = None


class RoutingSettingsResponse(BaseModel):
    smart_routing_enabled: bool
    routing_strategy: str
    available_strategies: dict
    # RouteLLM settings
    routellm_enabled: bool = False
    routellm_threshold: float = 0.11593
    routellm_available: bool = False  # System-level availability
    routellm_unavailable_reason: Optional[str] = None  # Why unavailable (if unavailable)
    cascade_routing_enabled: bool = False


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
    # RouteLLM fields
    routellm_used: bool = False
    routellm_win_rate: Optional[float] = None
    routellm_confident: bool = False
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

    routellm_status = get_routellm_status()
    return RoutingSettingsResponse(
        smart_routing_enabled=tenant.smart_routing_enabled or False,
        routing_strategy=tenant.routing_strategy or "cost_optimized",
        available_strategies=ROUTING_STRATEGIES,
        routellm_enabled=getattr(tenant, 'routellm_enabled', False) or False,
        routellm_threshold=float(tenant.routellm_threshold) if getattr(tenant, 'routellm_threshold', None) else 0.11593,
        routellm_available=routellm_status["available"],
        routellm_unavailable_reason=routellm_status["reason"],
        cascade_routing_enabled=getattr(tenant, 'cascade_routing_enabled', False) or False,
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

    # RouteLLM settings
    if settings.routellm_enabled is not None:
        tenant.routellm_enabled = settings.routellm_enabled

    if settings.routellm_threshold is not None:
        from decimal import Decimal
        tenant.routellm_threshold = Decimal(str(settings.routellm_threshold))

    if settings.cascade_routing_enabled is not None:
        tenant.cascade_routing_enabled = settings.cascade_routing_enabled

    await db.commit()
    await db.refresh(tenant)

    routellm_status = get_routellm_status()
    return RoutingSettingsResponse(
        smart_routing_enabled=tenant.smart_routing_enabled or False,
        routing_strategy=tenant.routing_strategy or "cost_optimized",
        available_strategies=ROUTING_STRATEGIES,
        routellm_enabled=getattr(tenant, 'routellm_enabled', False) or False,
        routellm_threshold=float(tenant.routellm_threshold) if getattr(tenant, 'routellm_threshold', None) else 0.11593,
        routellm_available=routellm_status["available"],
        routellm_unavailable_reason=routellm_status["reason"],
        cascade_routing_enabled=getattr(tenant, 'cascade_routing_enabled', False) or False,
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

    Uses ML-based routing pipeline:
    1. RouteLLM (Primary) - ML win-rate prediction (~85% cost savings at 95% quality)
    2. Semantic Classification (Fallback) - Embedding-based task classification

    No keyword-based heuristics - ML models provide better accuracy.
    """
    router_service = SmartRouter(db)

    # Import analyzer
    from app.services.smart_router import ComplexityAnalyzer, ROUTING_STRATEGIES, ROUTELLM_DEFAULT_THRESHOLD

    # Temporarily check routing without recording
    tenant = await router_service.get_tenant_settings(current_user.tenant_id)

    # Analyze using ML-based semantic classification
    complexity_score, complexity_reasons, task_info = ComplexityAnalyzer.analyze(
        request.messages, request.model, use_semantic=True
    )

    # RouteLLM variables
    routellm_used = False
    routellm_win_rate = None
    routellm_confident = False

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
            routellm_used=routellm_used,
            routellm_win_rate=routellm_win_rate,
            routellm_confident=routellm_confident,
            routing_reason="Routing disabled - enable to see routing decisions",
            estimated_savings_usd=0,
        )

    # Get routing decision (but don't record in test mode)
    strategy = ROUTING_STRATEGIES.get(tenant.routing_strategy, ROUTING_STRATEGIES["cost_optimized"])
    threshold = strategy["complexity_threshold"]
    routellm_threshold = float(tenant.routellm_threshold) if getattr(tenant, 'routellm_threshold', None) else ROUTELLM_DEFAULT_THRESHOLD

    provider = router_service.get_provider_for_model(request.model)

    routed_model = request.model
    routing_applied = False
    routing_reason = f"Complexity ({complexity_score:.2f}) above threshold ({threshold})"
    estimated_savings = 0.0

    # Define task_str for routing reason messages
    task_type = task_info.get("task_type")
    task_str = f"[{task_type}] " if task_type else ""

    # Try RouteLLM prediction if enabled
    routellm_decision = None
    if getattr(tenant, 'routellm_enabled', False) and is_routellm_available():
        try:
            routellm_service = get_routellm_service()
            if routellm_service.is_available():
                routellm_decision = routellm_service.route(
                    messages=request.messages,
                    provider=provider,
                    threshold=routellm_threshold,
                )
                routellm_used = True
                routellm_win_rate = routellm_decision["strong_win_rate"]
                routellm_confident = routellm_decision["is_confident"]
        except Exception:
            pass  # Fall back to complexity-based routing

    # Combined decision logic
    should_route_cheap = False
    routing_signal = "complexity"

    if routellm_decision and routellm_decision["is_confident"]:
        should_route_cheap = not routellm_decision["use_strong"]
        routing_signal = "routellm"
        win_rate = routellm_decision["strong_win_rate"]
    else:
        should_route_cheap = complexity_score < threshold
        routing_signal = "semantic"

    if should_route_cheap:
        alternative = router_service.get_alternative_model(request.model, provider, to_premium=False)
        if alternative and alternative.lower() != request.model.lower():
            routed_model = alternative
            routing_applied = True
            if routing_signal == "routellm":
                routing_reason = f"{task_str}RouteLLM: P(strong wins)={win_rate:.3f} < {routellm_threshold:.3f} - would route to {alternative}"
            else:
                routing_reason = f"{task_str}ML Semantic: score ({complexity_score:.2f}) - would route to {alternative}"
            estimated_savings = float(router_service.estimate_savings(request.model, alternative))
    else:
        if routing_signal == "routellm":
            routing_reason = f"{task_str}RouteLLM: P(strong wins)={win_rate:.3f} >= {routellm_threshold:.3f} - using original model"
        else:
            routing_reason = f"{task_str}ML Semantic: score ({complexity_score:.2f}) >= threshold ({threshold}) - using original model"

    return RouteRequestResponse(
        original_model=request.model,
        routed_model=routed_model,
        routing_applied=routing_applied,
        complexity_score=complexity_score,
        complexity_reasons=complexity_reasons,
        task_type=task_info.get("task_type"),
        task_confidence=task_info.get("task_confidence", 0.0),
        semantic_routing_used=task_info.get("semantic_available", False),
        routellm_used=routellm_used,
        routellm_win_rate=routellm_win_rate,
        routellm_confident=routellm_confident,
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
