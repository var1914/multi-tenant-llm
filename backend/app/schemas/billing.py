from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from decimal import Decimal
from uuid import UUID


# Pricing Plans
class PricingPlanResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly_usd: Decimal
    price_yearly_usd: Optional[Decimal] = None
    included_tokens: int
    overage_price_per_1k_tokens: Decimal
    max_customers: Optional[int] = None
    max_api_keys: Optional[int] = None
    features: Optional[List[str]] = None
    is_active: bool
    sort_order: int

    class Config:
        from_attributes = True


class PricingPlanPublic(BaseModel):
    """Public-facing pricing plan (without Stripe IDs)."""
    id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    price_monthly_usd: Decimal
    price_yearly_usd: Optional[Decimal] = None
    included_tokens: int
    overage_price_per_1k_tokens: Decimal
    max_customers: Optional[int] = None
    max_api_keys: Optional[int] = None
    features: Optional[List[str]] = None

    class Config:
        from_attributes = True


# Subscription
class SubscriptionResponse(BaseModel):
    tenant_id: UUID
    current_plan: Optional[PricingPlanPublic] = None
    subscription_status: Optional[str] = None
    subscription_period_end: Optional[datetime] = None
    stripe_subscription_id: Optional[str] = None


class SubscribeRequest(BaseModel):
    plan_slug: str = Field(..., description="The plan slug to subscribe to (starter, growth, scale)")
    billing_interval: str = Field(default="monthly", description="monthly or yearly")


class SubscriptionUpdateRequest(BaseModel):
    plan_slug: str = Field(..., description="The new plan slug")


class CancelSubscriptionRequest(BaseModel):
    reason: Optional[str] = Field(None, description="Optional cancellation reason")
    cancel_at_period_end: bool = Field(default=True, description="Cancel at end of current period or immediately")


# Billing Periods
class BillingPeriodResponse(BaseModel):
    id: UUID
    period_start: datetime
    period_end: datetime
    status: str

    # Usage summary
    total_tokens_used: int
    included_tokens: int
    overage_tokens: int

    # Costs
    base_cost_usd: Decimal
    overage_cost_usd: Decimal
    total_cost_usd: Decimal

    # Payment status
    stripe_invoice_id: Optional[str] = None
    payment_status: Optional[str] = None
    paid_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CurrentUsageResponse(BaseModel):
    """Current billing period usage summary."""
    period_start: datetime
    period_end: datetime
    tokens_used: int
    tokens_included: int
    tokens_remaining: int
    overage_tokens: int
    estimated_overage_cost: Decimal
    plan_name: str
    plan_base_cost: Decimal


# Stripe Webhooks
class StripeWebhookEvent(BaseModel):
    type: str
    data: dict


# Checkout Session
class CheckoutSessionResponse(BaseModel):
    checkout_url: str
    session_id: str


class BillingPortalResponse(BaseModel):
    portal_url: str
