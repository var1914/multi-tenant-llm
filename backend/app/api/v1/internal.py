"""
Internal API endpoints for LiteLLM integration.
These endpoints are authenticated via internal API key, not user JWT.
"""
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID
import hashlib

from app.database import get_db
from app.models.api_key import ApiKey
from app.models.tenant import Tenant
from app.models.end_customer import EndCustomer
from app.utils.security import verify_api_key
from app.config import settings
from app.services.usage_service import UsageService
from app.schemas.usage import UsageEventCreate
from app.services.smart_router import SmartRouter

router = APIRouter()


def verify_internal_key(x_internal_key: Optional[str] = Header(None, alias="X-Internal-Key")):
    """Verify internal API key for service-to-service communication."""
    if not x_internal_key:
        raise HTTPException(status_code=401, detail="Internal API key required")
    if x_internal_key != settings.USAGEFLOW_INTERNAL_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid internal API key")
    return True


class ValidateKeyRequest(BaseModel):
    api_key: str


class ValidateKeyResponse(BaseModel):
    valid: bool
    tenant_id: Optional[str] = None
    tenant_slug: Optional[str] = None
    environment: Optional[str] = None  # "live" or "test"
    key_id: Optional[str] = None


@router.post("/validate-key", response_model=ValidateKeyResponse)
async def validate_api_key(
    request: ValidateKeyRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_internal_key)
):
    """
    Validate a UsageFlow API key and return tenant info.
    Used by LiteLLM for custom authentication.
    """
    api_key = request.api_key.replace("Bearer ", "")

    # Validate format
    if not api_key.startswith(("uf_live_", "uf_test_")):
        return ValidateKeyResponse(valid=False)

    environment = "live" if api_key.startswith("uf_live_") else "test"

    # Find matching API key
    result = await db.execute(
        select(ApiKey).where(ApiKey.is_active == True)
    )
    api_keys = result.scalars().all()

    for key in api_keys:
        if verify_api_key(api_key, key.key_hash):
            # Update last used
            key.last_used_at = datetime.utcnow()
            await db.commit()

            # Get tenant
            tenant_result = await db.execute(
                select(Tenant).where(Tenant.id == key.tenant_id)
            )
            tenant = tenant_result.scalar_one_or_none()

            if tenant:
                return ValidateKeyResponse(
                    valid=True,
                    tenant_id=str(tenant.id),
                    tenant_slug=tenant.slug,
                    environment=environment,
                    key_id=str(key.id)
                )

    return ValidateKeyResponse(valid=False)


class LiteLLMUsageEvent(BaseModel):
    """Usage event from LiteLLM callback."""
    tenant_id: str
    customer_id: str
    model: str
    provider: str
    input_tokens: int
    output_tokens: int
    total_tokens: int
    cost_usd: Decimal
    request_id: str  # Used as idempotency key
    metadata: Optional[dict] = None
    timestamp: Optional[datetime] = None


class LiteLLMUsageResponse(BaseModel):
    success: bool
    event_id: Optional[str] = None
    message: Optional[str] = None


@router.post("/litellm-usage", response_model=LiteLLMUsageResponse)
async def track_litellm_usage(
    event: LiteLLMUsageEvent,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_internal_key)
):
    """
    Track usage event from LiteLLM callback.
    This endpoint is called by the LiteLLM custom callback handler.
    """
    try:
        tenant_id = UUID(event.tenant_id)

        # Verify tenant exists
        tenant_result = await db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        tenant = tenant_result.scalar_one_or_none()
        if not tenant:
            return LiteLLMUsageResponse(success=False, message="Tenant not found")

        # Check if customer exists, create if not
        customer_result = await db.execute(
            select(EndCustomer).where(
                EndCustomer.tenant_id == tenant_id,
                EndCustomer.external_id == event.customer_id
            )
        )
        customer = customer_result.scalar_one_or_none()

        if not customer:
            # Auto-create customer for LiteLLM requests
            customer = EndCustomer(
                tenant_id=tenant_id,
                external_id=event.customer_id,
                name=f"LiteLLM Customer: {event.customer_id}",
                metadata={"auto_created": True, "source": "litellm"}
            )
            db.add(customer)
            await db.commit()
            await db.refresh(customer)

        # Create usage event
        usage_data = UsageEventCreate(
            customer_id=event.customer_id,
            event_type="llm_completion",
            model=event.model,
            provider=event.provider,
            quantity=event.total_tokens,
            cost_usd=event.cost_usd,
            metadata={
                "input_tokens": event.input_tokens,
                "output_tokens": event.output_tokens,
                "source": "litellm",
                **(event.metadata or {})
            },
            idempotency_key=f"litellm_{event.request_id}",
            timestamp=event.timestamp
        )

        service = UsageService(db)
        result = await service.track_event(tenant_id, usage_data)

        return LiteLLMUsageResponse(
            success=True,
            event_id=str(result.event_id)
        )

    except Exception as e:
        return LiteLLMUsageResponse(
            success=False,
            message=str(e)
        )


@router.get("/health")
async def health_check():
    """Health check endpoint for internal services."""
    return {"status": "healthy", "service": "usageflow-internal-api"}


# Smart Routing Endpoints for LiteLLM
class RouteRequest(BaseModel):
    """Request for smart routing decision."""
    tenant_id: str
    model: str
    messages: List[dict]
    customer_id: Optional[str] = None
    request_id: Optional[str] = None


class RouteResponse(BaseModel):
    """Response with routing decision."""
    original_model: str
    routed_model: str
    routing_applied: bool
    complexity_score: Optional[float] = None
    routing_reason: Optional[str] = None
    estimated_savings_usd: float = 0


@router.post("/route", response_model=RouteResponse)
async def route_request(
    request: RouteRequest,
    db: AsyncSession = Depends(get_db),
    _: bool = Depends(verify_internal_key)
):
    """
    Get smart routing decision for a LLM request.
    Called by LiteLLM before making the actual API call.
    """
    try:
        tenant_id = UUID(request.tenant_id)

        # Get customer ID if provided
        end_customer_id = None
        if request.customer_id:
            customer_result = await db.execute(
                select(EndCustomer).where(
                    EndCustomer.tenant_id == tenant_id,
                    EndCustomer.external_id == request.customer_id
                )
            )
            customer = customer_result.scalar_one_or_none()
            if customer:
                end_customer_id = customer.id

        router_service = SmartRouter(db)
        result = await router_service.route_request(
            tenant_id=tenant_id,
            original_model=request.model,
            messages=request.messages,
            end_customer_id=end_customer_id,
            request_id=request.request_id,
        )

        return RouteResponse(
            original_model=request.model,
            routed_model=result["routed_model"],
            routing_applied=result["routing_applied"],
            complexity_score=result.get("complexity_score"),
            routing_reason=result.get("routing_reason"),
            estimated_savings_usd=float(result.get("estimated_savings_usd", 0)),
        )

    except Exception as e:
        # On error, return original model
        return RouteResponse(
            original_model=request.model,
            routed_model=request.model,
            routing_applied=False,
            routing_reason=f"Routing error: {str(e)}",
        )
