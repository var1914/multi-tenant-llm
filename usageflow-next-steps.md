# UsageFlow: Next Steps Roadmap
## From Working Prototype → Production-Ready Billing Platform

**Current State:** ✅ 70% MVP Complete
- Multi-tenant architecture ✓
- Usage tracking with idempotency ✓
- Customer management ✓
- Dashboard with analytics ✓
- Docker Compose dev environment ✓
- Feature/event_type analytics ✓
- Budget limits & alerts per customer ✓
- CSV export for billing integration ✓
- **Stripe billing integration ✓** (NEW - implemented!)

**What's Missing:** 🎯 Critical Path to Revenue
1. ~~Stripe billing integration (invoicing customers)~~ ✓ Done!
2. LiteLLM proxy auto-tracking (seamless usage capture)
3. AWS production deployment
4. ~~Pricing plans & subscription management~~ ✓ Done!
5. Embeddable customer usage widget

---

## ✅ COMPLETED: Stripe Billing Integration

### What's Implemented
- **Database**: `pricing_plans` and `billing_periods` tables with migrations (004 & 005)
- **Models**: `PricingPlan` and `BillingPeriod` SQLAlchemy models
- **Default Plans**: Starter ($299/mo), Growth ($699/mo), Scale ($1299/mo) seeded automatically
- **Services**:
  - `StripeService` - handles Stripe customer, checkout, portal, webhooks
  - `BillingService` - handles billing periods, usage tracking, overage calculation
- **API Endpoints** (`/api/v1/billing`):
  - `GET /plans` - List available pricing plans (public)
  - `GET /subscription` - Get current subscription status
  - `POST /checkout` - Create Stripe Checkout session
  - `POST /portal` - Create Stripe Billing Portal session
  - `POST /cancel` - Cancel subscription
  - `POST /webhooks` - Handle Stripe webhook events
  - `GET /history` - Get billing history
  - `GET /usage` - Get current period usage summary
  - `GET /config` - Get Stripe client configuration
- **Frontend**: Billing page with plan comparison, current usage, subscription management

### Local Testing with Stripe CLI

**1. Get Stripe Test Keys**
```bash
# Sign up at https://dashboard.stripe.com
# Navigate to https://dashboard.stripe.com/test/apikeys
# Copy your test keys
```

**2. Add Keys to .env**
```bash
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**3. Install Stripe CLI**
```bash
# macOS
brew install stripe/stripe-cli/stripe

# Windows (with scoop)
scoop install stripe

# Linux
# Download from https://github.com/stripe/stripe-cli/releases
```

**4. Login to Stripe CLI**
```bash
stripe login
```

**5. Create Products in Stripe (one-time setup)**
```bash
# Run this to create products and prices in Stripe Test Mode
# After creating, update pricing_plans table with stripe_price_id_monthly values

# Create Starter Plan
stripe products create --name="UsageFlow Starter" --metadata[plan_slug]=starter
stripe prices create --product=prod_xxx --unit-amount=29900 --currency=usd --recurring[interval]=month

# Create Growth Plan
stripe products create --name="UsageFlow Growth" --metadata[plan_slug]=growth
stripe prices create --product=prod_yyy --unit-amount=69900 --currency=usd --recurring[interval]=month

# Create Scale Plan
stripe products create --name="UsageFlow Scale" --metadata[plan_slug]=scale
stripe prices create --product=prod_zzz --unit-amount=129900 --currency=usd --recurring[interval]=month
```

**6. Update pricing_plans with Stripe Price IDs**
```sql
-- After creating products in Stripe, update the database
UPDATE pricing_plans SET stripe_price_id_monthly = 'price_xxx' WHERE slug = 'starter';
UPDATE pricing_plans SET stripe_price_id_monthly = 'price_yyy' WHERE slug = 'growth';
UPDATE pricing_plans SET stripe_price_id_monthly = 'price_zzz' WHERE slug = 'scale';
```

**7. Forward Webhooks to Local**
```bash
# Start webhook forwarding
stripe listen --forward-to localhost:8000/api/v1/billing/webhooks

# This will output a webhook signing secret (whsec_...)
# Update STRIPE_WEBHOOK_SECRET in .env with this value
```

**8. Run Migrations**
```bash
docker compose exec api alembic upgrade head
```

**9. Test the Flow**
1. Start all services: `docker compose up`
2. Login to the dashboard at http://localhost:3000
3. Navigate to Billing page
4. Select a plan and click "Select Plan"
5. You'll be redirected to Stripe Checkout (test mode)
6. Use test card: `4242 4242 4242 4242` (any future date, any CVC)
7. Complete checkout - you'll be redirected back to the Billing page
8. Check the terminal running `stripe listen` - you should see webhook events

---

## Priority 1: Stripe Billing Integration (Week 1-2)
**Goal:** Generate actual invoices based on tracked usage

### Phase 1A: Stripe Setup & Schema (3-4 days)

**New Database Tables:**
```sql
-- Pricing Plans
CREATE TABLE pricing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(50) NOT NULL UNIQUE,
    base_price_monthly NUMERIC(10, 2) NOT NULL,
    base_price_yearly NUMERIC(10, 2),
    included_usage JSONB DEFAULT '{}',  -- {"llm_tokens": 100000}
    overage_rates JSONB DEFAULT '{}',   -- {"llm_tokens": 0.00001}
    max_customers INTEGER,
    features JSONB DEFAULT '[]',
    stripe_product_id VARCHAR(100),
    stripe_price_id_monthly VARCHAR(100),
    stripe_price_id_yearly VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Billing Periods
CREATE TABLE billing_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'open',  -- open, closed, invoiced
    total_usage_quantity BIGINT DEFAULT 0,
    total_cost_usd NUMERIC(12, 4) DEFAULT 0.00,
    overage_quantity BIGINT DEFAULT 0,
    overage_cost_usd NUMERIC(12, 4) DEFAULT 0.00,
    stripe_invoice_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    UNIQUE(tenant_id, start_date)
);

-- Usage Aggregates (for faster billing calculations)
CREATE TABLE usage_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_id UUID NOT NULL REFERENCES customers(id),
    date DATE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    provider VARCHAR(50),
    total_quantity BIGINT DEFAULT 0,
    total_cost_usd NUMERIC(10, 6) DEFAULT 0.00,
    request_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, customer_id, date, event_type, model)
);

CREATE INDEX idx_usage_daily_tenant_date ON usage_daily_aggregates(tenant_id, date DESC);
CREATE INDEX idx_usage_daily_customer_date ON usage_daily_aggregates(customer_id, date DESC);

-- Add to tenants table
ALTER TABLE tenants ADD COLUMN stripe_customer_id VARCHAR(100);
ALTER TABLE tenants ADD COLUMN stripe_subscription_id VARCHAR(100);
ALTER TABLE tenants ADD COLUMN pricing_plan_id UUID REFERENCES pricing_plans(id);
ALTER TABLE tenants ADD COLUMN billing_cycle_day INTEGER DEFAULT 1;  -- Day of month billing occurs
```

**Seed Pricing Plans:**
```python
# scripts/seed_pricing_plans.py
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.models import PricingPlan

async def seed_plans():
    plans = [
        {
            "name": "Starter",
            "slug": "starter",
            "base_price_monthly": 299.00,
            "base_price_yearly": 2990.00,  # ~17% discount
            "included_usage": {
                "llm_tokens": 1_000_000,
                "image_generation": 1000
            },
            "overage_rates": {
                "llm_tokens": 0.00001,  # $0.01 per 1K tokens
                "image_generation": 0.02  # $0.02 per image
            },
            "max_customers": 500,
            "features": [
                "Up to 500 customers",
                "1M tokens/month included",
                "Email support",
                "API access",
                "Basic analytics"
            ]
        },
        {
            "name": "Growth",
            "slug": "growth",
            "base_price_monthly": 699.00,
            "base_price_yearly": 6990.00,
            "included_usage": {
                "llm_tokens": 5_000_000,
                "image_generation": 5000
            },
            "overage_rates": {
                "llm_tokens": 0.000008,
                "image_generation": 0.015
            },
            "max_customers": 2500,
            "features": [
                "Up to 2,500 customers",
                "5M tokens/month included",
                "Priority email support",
                "Webhooks",
                "Advanced analytics",
                "Custom rate limits"
            ]
        },
        {
            "name": "Scale",
            "slug": "scale",
            "base_price_monthly": 1299.00,
            "base_price_yearly": 12990.00,
            "included_usage": {
                "llm_tokens": 20_000_000,
                "image_generation": 20000
            },
            "overage_rates": {
                "llm_tokens": 0.000005,
                "image_generation": 0.01
            },
            "max_customers": 10000,
            "features": [
                "Up to 10,000 customers",
                "20M tokens/month included",
                "24/7 chat support",
                "SSO (SAML)",
                "Audit logs",
                "White-label dashboard",
                "Custom integrations"
            ]
        }
    ]
    
    for plan_data in plans:
        plan = PricingPlan(**plan_data)
        session.add(plan)
    
    await session.commit()

if __name__ == "__main__":
    asyncio.run(seed_plans())
```

**Stripe Product Creation:**
```python
# app/services/stripe_service.py
import stripe
from app.config import settings

stripe.api_key = settings.STRIPE_SECRET_KEY

class StripeService:
    
    async def create_pricing_plan_in_stripe(self, plan: PricingPlan):
        """Create Stripe product and prices for a pricing plan"""
        
        # Create product
        product = stripe.Product.create(
            name=plan.name,
            description=f"UsageFlow {plan.name} Plan",
            metadata={"plan_id": str(plan.id)}
        )
        
        # Create monthly price
        price_monthly = stripe.Price.create(
            product=product.id,
            unit_amount=int(plan.base_price_monthly * 100),  # Convert to cents
            currency="usd",
            recurring={"interval": "month"},
            metadata={"plan_id": str(plan.id), "interval": "monthly"}
        )
        
        # Create yearly price
        price_yearly = stripe.Price.create(
            product=product.id,
            unit_amount=int(plan.base_price_yearly * 100),
            currency="usd",
            recurring={"interval": "year"},
            metadata={"plan_id": str(plan.id), "interval": "yearly"}
        )
        
        # Update plan with Stripe IDs
        plan.stripe_product_id = product.id
        plan.stripe_price_id_monthly = price_monthly.id
        plan.stripe_price_id_yearly = price_yearly.id
        
        return product, price_monthly, price_yearly
    
    async def create_customer(self, tenant):
        """Create Stripe customer for tenant"""
        customer = stripe.Customer.create(
            email=tenant.admin_email,
            name=tenant.company_name,
            metadata={"tenant_id": str(tenant.id)}
        )
        
        tenant.stripe_customer_id = customer.id
        return customer
    
    async def create_subscription(self, tenant, plan, billing_interval="monthly"):
        """Create Stripe subscription"""
        
        if not tenant.stripe_customer_id:
            await self.create_customer(tenant)
        
        price_id = (plan.stripe_price_id_monthly 
                   if billing_interval == "monthly" 
                   else plan.stripe_price_id_yearly)
        
        subscription = stripe.Subscription.create(
            customer=tenant.stripe_customer_id,
            items=[{"price": price_id}],
            metadata={
                "tenant_id": str(tenant.id),
                "plan_id": str(plan.id)
            },
            trial_period_days=14  # 14-day free trial
        )
        
        tenant.stripe_subscription_id = subscription.id
        tenant.pricing_plan_id = plan.id
        tenant.subscription_status = subscription.status
        
        return subscription
    
    async def create_usage_meter(self):
        """Create Stripe Meter for usage-based billing"""
        
        # Create meter for tokens
        meter = stripe.billing.Meter.create(
            display_name="LLM Tokens",
            event_name="llm_tokens",
            default_aggregation={"formula": "sum"},
            customer_mapping={
                "event_payload_key": "stripe_customer_id",
                "type": "by_id"
            }
        )
        
        return meter
    
    async def record_usage_event(self, tenant, usage_event):
        """Send usage event to Stripe Meters"""
        
        if not tenant.stripe_customer_id:
            return None
        
        meter_event = stripe.billing.MeterEvent.create(
            event_name="llm_tokens",
            payload={
                "stripe_customer_id": tenant.stripe_customer_id,
                "value": str(usage_event.quantity)
            },
            identifier=usage_event.idempotency_key,  # Reuse idempotency key
            timestamp=int(usage_event.event_timestamp.timestamp())
        )
        
        return meter_event
```

**Action Items:**
- [ ] Run Alembic migration to add billing tables
- [ ] Seed pricing plans with `python scripts/seed_pricing_plans.py`
- [ ] Create Stripe products/prices for each plan
- [ ] Set up Stripe test mode keys in .env

### Phase 1B: Subscription Management API (2-3 days)

**New Endpoints:**
```python
# app/api/v1/billing.py
from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_tenant
from app.services.stripe_service import StripeService

router = APIRouter(prefix="/billing", tags=["billing"])

@router.get("/plans")
async def list_pricing_plans(db: AsyncSession = Depends(get_db)):
    """List all available pricing plans"""
    result = await db.execute(
        select(PricingPlan).where(PricingPlan.is_active == True)
    )
    plans = result.scalars().all()
    return {"plans": plans}

@router.post("/subscribe")
async def create_subscription(
    plan_slug: str,
    billing_interval: str = "monthly",
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Subscribe tenant to a pricing plan"""
    
    # Get plan
    result = await db.execute(
        select(PricingPlan).where(PricingPlan.slug == plan_slug)
    )
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    # Create Stripe subscription
    stripe_service = StripeService()
    subscription = await stripe_service.create_subscription(
        tenant, plan, billing_interval
    )
    
    await db.commit()
    
    return {
        "success": True,
        "subscription_id": subscription.id,
        "status": subscription.status,
        "trial_end": subscription.trial_end
    }

@router.get("/subscription")
async def get_current_subscription(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get current subscription details"""
    
    if not tenant.stripe_subscription_id:
        return {"subscription": None}
    
    # Fetch from Stripe
    subscription = stripe.Subscription.retrieve(tenant.stripe_subscription_id)
    
    # Get plan details
    result = await db.execute(
        select(PricingPlan).where(PricingPlan.id == tenant.pricing_plan_id)
    )
    plan = result.scalar_one_or_none()
    
    return {
        "subscription": {
            "id": subscription.id,
            "status": subscription.status,
            "current_period_start": subscription.current_period_start,
            "current_period_end": subscription.current_period_end,
            "trial_end": subscription.trial_end,
            "plan": plan
        }
    }

@router.post("/cancel")
async def cancel_subscription(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Cancel subscription at period end"""
    
    if not tenant.stripe_subscription_id:
        raise HTTPException(status_code=404, detail="No active subscription")
    
    subscription = stripe.Subscription.modify(
        tenant.stripe_subscription_id,
        cancel_at_period_end=True
    )
    
    return {
        "success": True,
        "cancel_at": subscription.cancel_at
    }

@router.get("/usage-summary")
async def get_billing_period_usage(
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db)
):
    """Get current billing period usage vs plan limits"""
    
    # Get current billing period
    today = date.today()
    billing_day = tenant.billing_cycle_day or 1
    
    if today.day >= billing_day:
        period_start = date(today.year, today.month, billing_day)
    else:
        # Previous month
        prev_month = today.month - 1 if today.month > 1 else 12
        prev_year = today.year if today.month > 1 else today.year - 1
        period_start = date(prev_year, prev_month, billing_day)
    
    # Calculate period end
    next_month = period_start.month + 1 if period_start.month < 12 else 1
    next_year = period_start.year if period_start.month < 12 else period_start.year + 1
    period_end = date(next_year, next_month, billing_day) - timedelta(days=1)
    
    # Query usage
    result = await db.execute(
        select(
            func.sum(UsageEvent.quantity).label("total_quantity"),
            func.sum(UsageEvent.cost_usd).label("total_cost")
        )
        .where(
            UsageEvent.tenant_id == tenant.id,
            UsageEvent.event_timestamp >= period_start,
            UsageEvent.event_timestamp <= period_end
        )
    )
    usage = result.one()
    
    # Get plan limits
    result = await db.execute(
        select(PricingPlan).where(PricingPlan.id == tenant.pricing_plan_id)
    )
    plan = result.scalar_one_or_none()
    
    included_tokens = plan.included_usage.get("llm_tokens", 0) if plan else 0
    overage_tokens = max(0, usage.total_quantity - included_tokens)
    overage_cost = overage_tokens * plan.overage_rates.get("llm_tokens", 0) if plan else 0
    
    return {
        "period_start": period_start,
        "period_end": period_end,
        "usage": {
            "total_tokens": usage.total_quantity or 0,
            "total_cost": float(usage.total_cost or 0),
            "included_tokens": included_tokens,
            "overage_tokens": overage_tokens,
            "overage_cost": float(overage_cost),
            "percentage_used": (usage.total_quantity / included_tokens * 100) if included_tokens > 0 else 0
        },
        "plan": plan
    }
```

**Frontend: Subscription Page**
```typescript
// src/pages/Subscription.tsx
import { useState, useEffect } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

interface Plan {
  id: string;
  name: string;
  slug: string;
  base_price_monthly: number;
  base_price_yearly: number;
  included_usage: {
    llm_tokens: number;
    image_generation?: number;
  };
  features: string[];
}

export default function Subscription() {
  const [selectedInterval, setSelectedInterval] = useState<'monthly' | 'yearly'>('monthly');
  
  // Fetch plans
  const { data: plansData } = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: () => apiClient.get('/billing/plans')
  });
  
  // Fetch current subscription
  const { data: subscriptionData } = useQuery({
    queryKey: ['subscription'],
    queryFn: () => apiClient.get('/billing/subscription')
  });
  
  // Fetch usage summary
  const { data: usageData } = useQuery({
    queryKey: ['usage-summary'],
    queryFn: () => apiClient.get('/billing/usage-summary')
  });
  
  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: (planSlug: string) => 
      apiClient.post('/billing/subscribe', { 
        plan_slug: planSlug,
        billing_interval: selectedInterval 
      }),
    onSuccess: () => {
      alert('Subscription created! Starting 14-day free trial.');
      window.location.reload();
    }
  });
  
  const plans: Plan[] = plansData?.data.plans || [];
  const currentSubscription = subscriptionData?.data.subscription;
  const usage = usageData?.data;
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Subscription & Billing</h1>
      
      {/* Current Usage */}
      {usage && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Current Billing Period</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tokens Used</p>
              <p className="text-2xl font-bold">
                {(usage.usage.total_tokens / 1000000).toFixed(2)}M
              </p>
              <p className="text-sm text-gray-500">
                of {(usage.usage.included_tokens / 1000000).toFixed(1)}M included
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Usage Percentage</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${Math.min(100, usage.usage.percentage_used)}%` }}
                  />
                </div>
                <span className="text-sm font-medium">
                  {usage.usage.percentage_used.toFixed(0)}%
                </span>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Overage Cost</p>
              <p className="text-2xl font-bold text-orange-600">
                ${usage.usage.overage_cost.toFixed(2)}
              </p>
              <p className="text-sm text-gray-500">
                {usage.usage.overage_tokens.toLocaleString()} tokens
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mt-4">
            Period: {usage.period_start} to {usage.period_end}
          </p>
        </div>
      )}
      
      {/* Current Plan */}
      {currentSubscription && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-semibold">Current Plan: {currentSubscription.plan.name}</h3>
              <p className="text-sm text-gray-600">
                Status: {currentSubscription.status}
              </p>
              {currentSubscription.trial_end && (
                <p className="text-sm text-blue-600">
                  Trial ends: {new Date(currentSubscription.trial_end * 1000).toLocaleDateString()}
                </p>
              )}
            </div>
            <button className="text-red-600 hover:text-red-700">
              Cancel Subscription
            </button>
          </div>
        </div>
      )}
      
      {/* Billing Interval Toggle */}
      <div className="flex justify-center mb-6">
        <div className="inline-flex rounded-lg border border-gray-300">
          <button
            className={`px-4 py-2 rounded-l-lg ${
              selectedInterval === 'monthly' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700'
            }`}
            onClick={() => setSelectedInterval('monthly')}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-r-lg ${
              selectedInterval === 'yearly' 
                ? 'bg-blue-600 text-white' 
                : 'bg-white text-gray-700'
            }`}
            onClick={() => setSelectedInterval('yearly')}
          >
            Yearly <span className="text-sm">(Save 17%)</span>
          </button>
        </div>
      </div>
      
      {/* Pricing Plans */}
      <div className="grid grid-cols-3 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="border rounded-lg p-6 hover:shadow-lg transition">
            <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
            <div className="mb-4">
              <span className="text-4xl font-bold">
                ${selectedInterval === 'monthly' 
                  ? plan.base_price_monthly 
                  : plan.base_price_yearly}
              </span>
              <span className="text-gray-600">
                /{selectedInterval === 'monthly' ? 'mo' : 'yr'}
              </span>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">Includes:</p>
              <p className="font-semibold">
                {(plan.included_usage.llm_tokens / 1000000).toFixed(1)}M tokens/month
              </p>
            </div>
            
            <ul className="space-y-2 mb-6">
              {plan.features.map((feature, idx) => (
                <li key={idx} className="text-sm flex items-start">
                  <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            
            <button
              onClick={() => subscribeMutation.mutate(plan.slug)}
              disabled={currentSubscription?.plan.slug === plan.slug}
              className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
            >
              {currentSubscription?.plan.slug === plan.slug 
                ? 'Current Plan' 
                : 'Subscribe'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Action Items:**
- [ ] Add billing endpoints to FastAPI
- [ ] Create Subscription page in React
- [ ] Test subscription creation flow
- [ ] Verify 14-day trial works correctly

---

## Priority 2: LiteLLM Proxy Auto-Tracking (Week 2)
**Goal:** Customers use LiteLLM proxy URL, usage auto-tracked

### Current Setup (Manual Tracking)
```python
# Customer's code today
import openai

openai.api_base = "https://api.openai.com/v1"
openai.api_key = "sk-..."

response = openai.ChatCompletion.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}]
)

# Then manually track:
requests.post("https://api.usageflow.com/usage/track", json={
    "customer_id": "customer_123",
    "event_type": "llm_tokens",
    "quantity": response.usage.total_tokens,
    ...
})
```

### New Setup (Automatic Tracking)
```python
# Customer's code with UsageFlow
import openai

openai.api_base = "https://proxy.usageflow.com/v1"
openai.api_key = "uf_live_xxxxx"  # UsageFlow API key

response = openai.ChatCompletion.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello"}],
    user="customer_123"  # Customer identifier
)

# Usage automatically tracked! ✓
```

### Implementation Steps

**1. Enhance LiteLLM Config**
```yaml
# litellm_config.yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
      
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  
  # Authentication via UsageFlow API keys
  custom_auth: usageflow_auth
  
  # Success callback to UsageFlow API
  success_callback: ["usageflow_webhook"]

# Custom authentication handler
usageflow_auth:
  type: "api_key"
  api_endpoint: "https://api.usageflow.com/api/v1/internal/validate-key"
  auth_header: "Authorization"
```

**2. Create Internal Validation Endpoint**
```python
# app/api/v1/internal.py
from fastapi import APIRouter, Header, HTTPException
from app.utils.auth import verify_api_key

router = APIRouter(prefix="/internal", tags=["internal"])

@router.post("/validate-key")
async def validate_api_key(
    authorization: str = Header(...),
    db: AsyncSession = Depends(get_db)
):
    """Validate API key for LiteLLM proxy (internal use only)"""
    
    # Extract key from "Bearer uf_live_xxx"
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    api_key = authorization.replace("Bearer ", "")
    
    # Verify key
    result = await verify_api_key(api_key, db)
    
    if not result:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    tenant, api_key_obj = result
    
    return {
        "valid": True,
        "tenant_id": str(tenant.id),
        "tenant_name": tenant.company_name,
        "api_key_id": str(api_key_obj.id),
        "environment": api_key_obj.environment
    }
```

**3. Custom LiteLLM Callback**
```python
# litellm_usageflow_callback.py
from litellm.integrations.custom_logger import CustomLogger
import httpx
import os

class UsageFlowCallback(CustomLogger):
    
    def __init__(self):
        self.api_url = os.getenv("USAGEFLOW_API_URL", "http://backend:8000")
        super().__init__()
    
    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        """Auto-track usage to UsageFlow"""
        
        # Extract metadata
        metadata = kwargs.get("metadata", {})
        api_key = metadata.get("api_key")  # UsageFlow API key
        customer_id = kwargs.get("user")  # Customer identifier from user param
        
        if not customer_id or not api_key:
            print("Skipping: No customer_id or api_key")
            return
        
        # Calculate usage
        usage = response_obj.get("usage", {})
        model = kwargs.get("model")
        
        # Send to UsageFlow
        payload = {
            "customer_id": customer_id,
            "event_type": "llm_tokens",
            "model": model,
            "provider": self._get_provider(model),
            "quantity": usage.get("total_tokens", 0),
            "cost_usd": self._calculate_cost(model, usage),
            "metadata": {
                "request_id": response_obj.get("id"),
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "latency_ms": int((end_time - start_time) * 1000)
            },
            "idempotency_key": response_obj.get("id"),
            "timestamp": response_obj.get("created")
        }
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.api_url}/api/v1/usage/track",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=5.0
                )
        except Exception as e:
            print(f"UsageFlow callback error: {e}")
    
    def _get_provider(self, model: str) -> str:
        if "gpt" in model.lower():
            return "openai"
        elif "claude" in model.lower():
            return "anthropic"
        return "unknown"
    
    def _calculate_cost(self, model: str, usage: dict) -> float:
        """Calculate cost based on model pricing"""
        pricing = {
            "gpt-4o": {"input": 2.50, "output": 10.00},
            "gpt-4o-mini": {"input": 0.15, "output": 0.60},
            "claude-sonnet-4": {"input": 3.00, "output": 15.00},
        }
        
        model_pricing = pricing.get(model, {"input": 1.0, "output": 2.0})
        
        prompt_tokens = usage.get("prompt_tokens", 0)
        completion_tokens = usage.get("completion_tokens", 0)
        
        cost = (prompt_tokens / 1_000_000) * model_pricing["input"]
        cost += (completion_tokens / 1_000_000) * model_pricing["output"]
        
        return round(cost, 6)
```

**Action Items:**
- [ ] Update litellm_config.yaml with custom auth
- [ ] Create internal validation endpoint
- [ ] Deploy custom callback to LiteLLM container
- [ ] Update Docker Compose with environment variables
- [ ] Test end-to-end: LiteLLM request → auto-tracked in UsageFlow

---

## Priority 3: AWS Production Deployment (Week 3-4)
**Goal:** Move from Docker Compose to production-ready AWS infrastructure

**What You Already Have:**
- Working Docker images (backend, LiteLLM)
- PostgreSQL schema
- React frontend build

**What's Needed:**
1. AWS infrastructure setup (Terraform)
2. ECS Fargate deployment
3. RDS PostgreSQL migration
4. ElastiCache Redis
5. S3 + CloudFront for frontend
6. CI/CD pipeline

**Detailed deployment guide:** See `usageflow-aws-implementation.md` sections on:
- Terraform modules (networking, ECS, RDS, ElastiCache)
- GitHub Actions CI/CD
- Migration from Docker Compose → AWS

**Estimated Cost:** $50-75/month with AWS Free Tier

---

## Priority 4: Invoice Generation & Email (Week 4-5)
**Goal:** Auto-generate monthly invoices and email to customers

**Background Job:**
```python
# app/workers/invoice_generator.py
import boto3
from datetime import date, timedelta
from sqlalchemy import select, func
from app.models import Tenant, BillingPeriod, UsageEvent

async def generate_monthly_invoices():
    """Run on 1st of every month via EventBridge cron"""
    
    # Get all active tenants
    result = await db.execute(
        select(Tenant).where(Tenant.subscription_status == 'active')
    )
    tenants = result.scalars().all()
    
    for tenant in tenants:
        await generate_invoice_for_tenant(tenant)

async def generate_invoice_for_tenant(tenant: Tenant):
    """Generate invoice for specific tenant's last billing period"""
    
    # Calculate last billing period
    today = date.today()
    period_start = date(today.year, today.month - 1, tenant.billing_cycle_day)
    period_end = date(today.year, today.month, tenant.billing_cycle_day) - timedelta(days=1)
    
    # Aggregate usage
    result = await db.execute(
        select(
            func.sum(UsageEvent.quantity),
            func.sum(UsageEvent.cost_usd)
        )
        .where(
            UsageEvent.tenant_id == tenant.id,
            UsageEvent.event_timestamp >= period_start,
            UsageEvent.event_timestamp <= period_end
        )
    )
    total_quantity, total_cost = result.one()
    
    # Calculate overage
    plan = await db.get(PricingPlan, tenant.pricing_plan_id)
    included = plan.included_usage.get("llm_tokens", 0)
    overage_quantity = max(0, total_quantity - included)
    overage_cost = overage_quantity * plan.overage_rates.get("llm_tokens", 0)
    
    # Create billing period record
    billing_period = BillingPeriod(
        tenant_id=tenant.id,
        start_date=period_start,
        end_date=period_end,
        total_usage_quantity=total_quantity,
        total_cost_usd=total_cost,
        overage_quantity=overage_quantity,
        overage_cost_usd=overage_cost,
        status="closed"
    )
    db.add(billing_period)
    
    # Create Stripe invoice
    invoice = stripe.Invoice.create(
        customer=tenant.stripe_customer_id,
        auto_advance=True,  # Auto-finalize
        description=f"UsageFlow Usage: {period_start} to {period_end}",
        metadata={
            "tenant_id": str(tenant.id),
            "billing_period_id": str(billing_period.id)
        }
    )
    
    # Add base subscription fee (handled by Stripe subscription)
    # Add overage charge
    if overage_cost > 0:
        stripe.InvoiceItem.create(
            customer=tenant.stripe_customer_id,
            invoice=invoice.id,
            amount=int(overage_cost * 100),  # Convert to cents
            currency="usd",
            description=f"Token overage: {overage_quantity:,} tokens"
        )
    
    billing_period.stripe_invoice_id = invoice.id
    await db.commit()
    
    # Send email notification
    await send_invoice_email(tenant, invoice, billing_period)
```

**Action Items:**
- [ ] Create EventBridge rule for monthly cron
- [ ] Implement invoice generation worker
- [ ] Set up SES for transactional emails
- [ ] Design invoice email template

---

## Priority 5: Embeddable Customer Widget (Week 5-6)
**Goal:** Customers can embed usage dashboard for their end-users

**Use Case:**
```html
<!-- Customer embeds in their app -->
<iframe 
  src="https://app.usageflow.com/embed/usage?token=xxx"
  width="100%"
  height="600px"
></iframe>
```

**Implementation:**
```typescript
// src/pages/EmbeddedUsage.tsx
export default function EmbeddedUsage() {
  const { token } = useParams();
  const { data, isLoading } = useQuery({
    queryKey: ['embedded-usage', token],
    queryFn: () => apiClient.get(`/usage/embed/${token}`)
  });
  
  if (isLoading) return <div>Loading...</div>;
  
  return (
    <div className="p-4 bg-white">
      <h2 className="text-xl font-bold mb-4">Your AI Usage</h2>
      
      {/* Usage chart */}
      <LineChart data={data.daily_usage} />
      
      {/* Current billing cycle */}
      <div className="mt-4">
        <p>Current cycle: {data.period_start} - {data.period_end}</p>
        <p>Tokens used: {data.total_tokens.toLocaleString()}</p>
        <p>Estimated cost: ${data.estimated_cost.toFixed(2)}</p>
      </div>
    </div>
  );
}
```

**Backend Endpoint:**
```python
@router.get("/embed/{token}")
async def get_embedded_usage(token: str, db: AsyncSession = Depends(get_db)):
    """Get usage data for embedded widget (token-based auth)"""
    
    # Decode token (JWT with customer_id + expiry)
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        customer_id = payload.get("customer_id")
    except:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    # Fetch usage
    # ... (similar to usage summary endpoint)
    
    return {
        "customer_name": customer.name,
        "period_start": period_start,
        "period_end": period_end,
        "total_tokens": total_tokens,
        "daily_usage": [...],
        "estimated_cost": cost
    }
```

---

## Summary: 6-Week Path to Full MVP

| Week | Focus | Deliverable |
|------|-------|-------------|
| 1 | Stripe Integration | Subscription plans, billing API |
| 2 | LiteLLM Auto-Tracking | Proxy auto-tracks usage |
| 3-4 | AWS Deployment | Production infrastructure |
| 4 | Invoice Generation | Monthly automated invoices |
| 5 | Customer Widget | Embeddable usage dashboard |
| 6 | Testing & Polish | Load tests, security audit |

**After 6 weeks:** Production-ready platform ready for first paying customers! 🚀

---

## What to Build First (Today/This Week)?

I recommend: **Stripe Integration (Phase 1A + 1B)**

**Why?**
- Builds on your existing strong foundation
- Core monetization feature
- No infrastructure changes needed (works with Docker Compose)
- High value: turns usage tracking into revenue
- Can launch private beta once complete

**This Week's Action Items:**
1. Run database migration for billing tables
2. Seed pricing plans
3. Create Stripe products/prices
4. Build subscription management endpoints
5. Create Subscription page in React

Want me to generate the complete code for any of these? I can provide:
- Complete Alembic migration for billing tables
- Full StripeService implementation
- Frontend Subscription page component
- Or dive deeper into LiteLLM proxy setup
