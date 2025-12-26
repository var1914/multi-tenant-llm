from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from typing import List
from datetime import datetime, timedelta

from app.database import get_db
from app.models.tenant import Tenant
from app.models.pricing_plan import PricingPlan
from app.models.billing_period import BillingPeriod
from app.schemas.billing import (
    PricingPlanPublic,
    SubscriptionResponse,
    SubscribeRequest,
    CancelSubscriptionRequest,
    CheckoutSessionResponse,
    BillingPortalResponse,
    BillingPeriodResponse,
    CurrentUsageResponse,
)
from app.services.stripe_service import StripeService
from app.services.billing_service import BillingService
from app.dependencies import get_current_tenant_id
from app.config import settings

router = APIRouter()


def is_demo_mode() -> bool:
    """Check if we're in demo mode (no Stripe configured)."""
    return not settings.STRIPE_SECRET_KEY


@router.get("/plans", response_model=List[PricingPlanPublic])
async def get_pricing_plans(
    db: AsyncSession = Depends(get_db)
):
    """
    Get all available pricing plans.
    This endpoint is public and doesn't require authentication.
    """
    result = await db.execute(
        select(PricingPlan)
        .where(PricingPlan.is_active == True)
        .order_by(PricingPlan.sort_order)
    )
    plans = result.scalars().all()
    return [PricingPlanPublic.model_validate(p) for p in plans]


@router.get("/subscription", response_model=SubscriptionResponse)
async def get_current_subscription(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get the current subscription status for the authenticated tenant.
    """
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get current plan details if set
    current_plan = None
    if tenant.current_plan_id:
        plan_result = await db.execute(
            select(PricingPlan).where(PricingPlan.id == tenant.current_plan_id)
        )
        plan = plan_result.scalar_one_or_none()
        if plan:
            current_plan = PricingPlanPublic.model_validate(plan)

    return SubscriptionResponse(
        tenant_id=tenant.id,
        current_plan=current_plan,
        subscription_status=tenant.subscription_status,
        subscription_period_end=tenant.subscription_period_end,
        stripe_subscription_id=tenant.stripe_subscription_id,
    )


@router.post("/checkout", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    request: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Create a Stripe Checkout session to subscribe to a plan.
    Returns a URL to redirect the user to Stripe Checkout.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please set STRIPE_SECRET_KEY."
        )

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    stripe_service = StripeService(db)
    try:
        session = await stripe_service.create_checkout_session(
            tenant=tenant,
            plan_slug=request.plan_slug,
            billing_interval=request.billing_interval,
        )
        return CheckoutSessionResponse(**session)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/portal", response_model=BillingPortalResponse)
async def create_billing_portal_session(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Create a Stripe Billing Portal session for managing subscription.
    Returns a URL to redirect the user to the Stripe portal.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured. Please set STRIPE_SECRET_KEY."
        )

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="No billing account found. Please subscribe to a plan first."
        )

    stripe_service = StripeService(db)
    try:
        portal_url = await stripe_service.create_billing_portal_session(tenant)
        return BillingPortalResponse(portal_url=portal_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Cancel the current subscription.
    By default, the subscription will remain active until the end of the current billing period.
    """
    if not settings.STRIPE_SECRET_KEY:
        raise HTTPException(
            status_code=503,
            detail="Stripe is not configured."
        )

    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.stripe_subscription_id:
        raise HTTPException(
            status_code=400,
            detail="No active subscription to cancel."
        )

    stripe_service = StripeService(db)
    try:
        result = await stripe_service.cancel_subscription(
            tenant=tenant,
            cancel_at_period_end=request.cancel_at_period_end,
            reason=request.reason,
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/webhooks")
async def handle_stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db)
):
    """
    Handle incoming Stripe webhook events.
    This endpoint should not require authentication - Stripe validates via signature.
    """
    if not settings.STRIPE_WEBHOOK_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Stripe webhooks not configured."
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(status_code=400, detail="Missing Stripe signature")

    stripe_service = StripeService(db)
    try:
        result = await stripe_service.handle_webhook_event(payload, sig_header)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/history", response_model=List[BillingPeriodResponse])
async def get_billing_history(
    limit: int = 12,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get billing history (past billing periods).
    """
    result = await db.execute(
        select(BillingPeriod)
        .where(BillingPeriod.tenant_id == tenant_id)
        .order_by(BillingPeriod.period_start.desc())
        .limit(limit)
    )
    periods = result.scalars().all()
    return [BillingPeriodResponse.model_validate(p) for p in periods]


@router.get("/usage", response_model=CurrentUsageResponse)
async def get_current_usage(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Get current billing period usage summary.
    Shows tokens used, included, remaining, and estimated overage costs.
    """
    billing_service = BillingService(db)
    return await billing_service.get_current_usage(tenant_id)


@router.get("/config")
async def get_billing_config():
    """
    Get Stripe publishable key and other client-side config.
    """
    return {
        "stripe_publishable_key": settings.STRIPE_PUBLISHABLE_KEY,
        "stripe_configured": bool(settings.STRIPE_SECRET_KEY),
        "demo_mode": is_demo_mode(),
    }


@router.post("/demo-subscribe")
async def demo_subscribe(
    request: SubscribeRequest,
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Demo subscription endpoint for testing without Stripe.
    Directly activates a subscription without payment.
    Only available when Stripe is not configured.
    """
    if not is_demo_mode():
        raise HTTPException(
            status_code=400,
            detail="Demo mode is disabled. Use /checkout for Stripe payments."
        )

    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Get plan
    plan_result = await db.execute(
        select(PricingPlan).where(
            PricingPlan.slug == request.plan_slug,
            PricingPlan.is_active == True
        )
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail=f"Plan '{request.plan_slug}' not found")

    # Activate subscription directly
    tenant.current_plan_id = plan.id
    tenant.subscription_status = "active"
    tenant.subscription_plan = plan.slug
    tenant.subscription_period_end = datetime.utcnow() + timedelta(days=30)
    tenant.stripe_subscription_id = f"demo_sub_{tenant_id}"  # Demo subscription ID

    await db.commit()

    return {
        "success": True,
        "message": f"Demo subscription activated for {plan.name} plan",
        "plan": PricingPlanPublic.model_validate(plan),
        "subscription_status": "active",
        "period_end": tenant.subscription_period_end,
    }


@router.post("/demo-cancel")
async def demo_cancel_subscription(
    db: AsyncSession = Depends(get_db),
    tenant_id: UUID = Depends(get_current_tenant_id)
):
    """
    Demo cancel subscription endpoint for testing without Stripe.
    Only available when Stripe is not configured.
    """
    if not is_demo_mode():
        raise HTTPException(
            status_code=400,
            detail="Demo mode is disabled. Use /cancel for Stripe cancellation."
        )

    # Get tenant
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if not tenant.current_plan_id:
        raise HTTPException(status_code=400, detail="No active subscription to cancel")

    # Cancel subscription
    tenant.subscription_status = "canceled"
    tenant.stripe_subscription_id = None

    await db.commit()

    return {
        "success": True,
        "message": "Demo subscription canceled",
        "subscription_status": "canceled",
    }
