# UsageFlow: AWS-Native Technical Implementation Plan

**Target:** Production-ready multi-tenant LLM billing platform
**Budget:** $50-150/month AWS infrastructure cost
**Timeline:** 13-20 weeks for MVP
**Developer:** 1 engineer @ 20hrs/week

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│                                                                   │
│  ┌──────────────┐      ┌──────────────┐     ┌─────────────┐    │
│  │   Route 53   │──────│  CloudFront  │─────│   S3 (SPA)  │    │
│  │   (Domain)   │      │     (CDN)    │     │  Dashboard  │    │
│  └──────────────┘      └──────────────┘     └─────────────┘    │
│                                │                                 │
│                                ▼                                 │
│  ┌────────────────────────────────────────────────────────┐    │
│  │              Application Load Balancer                  │    │
│  └────────────────┬───────────────────┬───────────────────┘    │
│                   │                   │                          │
│         ┌─────────▼────────┐  ┌──────▼──────────┐              │
│         │  ECS Fargate      │  │  ECS Fargate    │              │
│         │  API Service      │  │  LiteLLM Proxy  │              │
│         │  (FastAPI)        │  │                 │              │
│         └─────────┬─────────┘  └──────┬──────────┘              │
│                   │                   │                          │
│         ┌─────────▼────────────────────▼──────────┐             │
│         │       RDS PostgreSQL (Multi-AZ)         │             │
│         │     (or Aurora Serverless v2)           │             │
│         └─────────────────────────────────────────┘             │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐       │
│  │ElastiCache   │    │  SQS Queue   │    │   Lambda    │       │
│  │  Redis       │    │ (Async Jobs) │    │ (Webhooks)  │       │
│  └──────────────┘    └──────────────┘    └─────────────┘       │
│                                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌─────────────┐       │
│  │  EventBridge │    │  CloudWatch  │    │ Secrets Mgr │       │
│  │ (Scheduler)  │    │   (Logs)     │    │  (API Keys) │       │
│  └──────────────┘    └──────────────┘    └─────────────┘       │
└───────────────────────────────────────────────────────────────┘
```

---

## AWS Service Selection & Cost Breakdown

### Compute Layer

**Option 1: ECS Fargate (Recommended for MVP)**
- **Why:** Serverless containers, no EC2 management, auto-scaling
- **Cost:** $0.04048/vCPU/hr + $0.004445/GB/hr
- **Configuration:** 0.25 vCPU, 0.5 GB per task
- **Estimated:** ~$15-25/month for 2 services running 24/7

**Option 2: EC2 t4g.micro (Cost-optimized alternative)**
- **Why:** Fixed cost, better for 24/7 workloads when scaling is predictable
- **Cost:** $0.0084/hr = $6.13/month (reserved) or $7.67/month (on-demand)
- **Configuration:** 2 vCPU, 1 GB RAM (ARM-based Graviton)
- **Estimated:** $12-15/month for 2 instances + ALB

**Option 3: EKS (Not recommended for MVP - overkill)**
- **Cost:** $73/month cluster + worker nodes
- **Use case:** Only if planning multi-region or 100+ microservices

**Decision:** Start with **Fargate** for simplicity, migrate to EC2 t4g if costs exceed $50/month.

### Database Layer

**Option 1: RDS PostgreSQL (Recommended)**
- **Instance:** db.t4g.micro (2 vCPU, 1 GB)
- **Storage:** 20 GB gp3 SSD
- **Backup:** 7-day automated backups
- **Cost:** ~$13.70/month (Single-AZ) or ~$27/month (Multi-AZ)
- **Performance:** Sufficient for 500-1000 customers

**Option 2: Aurora Serverless v2 (Scale-to-zero alternative)**
- **ACU:** 0.5-1 ACU (1 GB-2 GB RAM)
- **Cost:** $0.12/ACU-hour when active, $0.06/GB-month storage
- **Estimated:** $8-20/month with auto-pause
- **Caveat:** Cold start latency 25-30 seconds

**Decision:** Start with **RDS PostgreSQL db.t4g.micro Single-AZ** ($13.70/month), upgrade to Multi-AZ when revenue justifies.

### Caching Layer

**ElastiCache Redis**
- **Instance:** cache.t4g.micro (2 vCPU, 0.5 GB)
- **Cost:** $0.017/hr = $12.41/month
- **Use case:** Session storage, rate limiting, LRU cache for pricing rules
- **Alternative:** Redis on EC2 with persistence ($0 extra if using EC2 compute)

### Storage Layer

**S3 + CloudFront**
- **S3:** React SPA hosting (~100 MB) = $0.023/month
- **CloudFront:** 10 GB transfer/month = $0.85/month
- **Request costs:** ~1,000 requests/month = $0.005
- **Total:** ~$1/month

### Message Queue & Background Jobs

**SQS + Lambda (Recommended)**
- **SQS:** 1M requests free tier, then $0.40/million
- **Lambda:** 1M requests free tier, then $0.20/million + compute
- **Use case:** Stripe webhook processing, invoice generation, usage aggregation
- **Cost:** $0-5/month for MVP volume

**Alternative: ECS Fargate worker tasks**
- **Cost:** Same as API service (~$12/month for dedicated worker)
- **Use case:** If needing long-running jobs (>15 min Lambda limit)

### Monitoring & Secrets

**CloudWatch**
- **Logs:** 5 GB/month free tier
- **Metrics:** 10 custom metrics free
- **Cost:** $0-3/month for MVP

**Secrets Manager**
- **Cost:** $0.40/secret/month
- **Secrets needed:** 5-10 (Stripe keys, DB password, JWT secret, OpenAI keys)
- **Total:** $2-4/month

**Alternative:** Parameter Store (free for standard parameters)

### Total Monthly Cost Estimate

| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **ECS Fargate** | 2 services, 0.25 vCPU each | $20-30 |
| **RDS PostgreSQL** | db.t4g.micro, 20 GB | $14 |
| **ElastiCache Redis** | cache.t4g.micro | $12 |
| **ALB** | Application Load Balancer | $16 |
| **S3 + CloudFront** | Static hosting | $1 |
| **SQS + Lambda** | Background jobs | $2 |
| **Secrets Manager** | 6 secrets | $2.40 |
| **CloudWatch** | Logs + metrics | $2 |
| **Route 53** | Hosted zone | $0.50 |
| **Data transfer** | 50 GB/month | $4.50 |
| **TOTAL** | | **$74.40/month** |

**Free Tier Benefits (First 12 months):**
- RDS: 750 hours db.t3.micro/month → Save ~$13/month
- EC2/Fargate: 50 GB data transfer → Save ~$4.50/month
- Lambda: 1M requests + 400K GB-seconds → Save ~$5/month

**Actual cost in Year 1:** ~$50-55/month with Free Tier

---

## Detailed Technical Stack

### Backend (FastAPI)

```python
# Core dependencies
fastapi==0.109.0
uvicorn[standard]==0.27.0
sqlalchemy==2.0.25
alembic==1.13.1
psycopg2-binary==2.9.9
redis==5.0.1
stripe==8.0.0
pydantic==2.5.3
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
httpx==0.26.0
celery==5.3.6  # If using Celery instead of SQS+Lambda
boto3==1.34.20  # AWS SDK
```

**Why FastAPI:**
- Async support for high-concurrency LLM requests
- Auto-generated OpenAPI docs
- Pydantic validation reduces bugs
- Native support for dependency injection (perfect for multi-tenancy)

### Database (PostgreSQL 15+)

**Extensions to enable:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "timescaledb";  -- For time-series optimization
```

**TimescaleDB rationale:** Usage events are time-series data. TimescaleDB provides:
- Automatic partitioning by time
- Efficient compression (70-90% reduction)
- Continuous aggregates for real-time dashboards
- Fast range queries for billing periods

**Installation on RDS:** Not natively supported. Options:
1. Use standard PostgreSQL with manual partitioning
2. Self-host PostgreSQL on EC2 with TimescaleDB
3. Use Aurora with custom time-based partitioning

**Recommendation:** Start with standard RDS PostgreSQL + manual partitioning, migrate to EC2+TimescaleDB if query performance becomes bottleneck.

### Frontend (React + TypeScript)

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-router-dom": "^6.21.0",
    "axios": "^1.6.5",
    "recharts": "^2.10.3",
    "@tanstack/react-query": "^5.17.19",
    "@stripe/stripe-js": "^2.4.0",
    "zustand": "^4.4.7",
    "date-fns": "^3.0.6",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "typescript": "^5.3.3",
    "vite": "^5.0.11",
    "@types/react": "^18.2.48"
  }
}
```

**Why Vite:**
- 10x faster builds than Create React App
- Native ESM dev server
- Optimal for S3+CloudFront deployment

### Infrastructure as Code (Terraform)

```hcl
# versions.tf
terraform {
  required_version = ">= 1.6"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket = "usageflow-terraform-state"
    key    = "prod/terraform.tfstate"
    region = "us-east-1"
  }
}
```

**Why Terraform:**
- Industry standard, better than CloudFormation for readability
- Supports drift detection
- Easy rollbacks
- Strong AWS provider with 1000+ resources

---

## Database Schema Design

### Core Tables

```sql
-- ============================================
-- TENANTS & AUTHENTICATION
-- ============================================

CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    stripe_customer_id VARCHAR(100) UNIQUE,
    stripe_subscription_id VARCHAR(100),
    subscription_status VARCHAR(50) DEFAULT 'trialing',
    subscription_plan VARCHAR(50) DEFAULT 'starter',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_stripe_customer ON tenants(stripe_customer_id);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- admin, member
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- END CUSTOMERS (Multi-tenant isolation)
-- ============================================

CREATE TABLE end_customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL, -- Customer's identifier in their system
    name VARCHAR(255),
    email VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, external_id)
);

CREATE INDEX idx_end_customers_tenant ON end_customers(tenant_id);
CREATE INDEX idx_end_customers_external ON end_customers(tenant_id, external_id);

-- ============================================
-- API KEYS (Authentication for API usage)
-- ============================================

CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    key_prefix VARCHAR(20) NOT NULL, -- uf_live_xxxx or uf_test_xxxx
    key_hash VARCHAR(255) NOT NULL UNIQUE, -- bcrypt hash of full key
    name VARCHAR(255),
    environment VARCHAR(20) NOT NULL DEFAULT 'production', -- production, test
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash);

-- ============================================
-- USAGE EVENTS (Time-series data)
-- ============================================

CREATE TABLE usage_events (
    id UUID DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    end_customer_id UUID NOT NULL REFERENCES end_customers(id) ON DELETE CASCADE,
    event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL, -- llm_tokens, api_call, embedding_tokens
    model VARCHAR(100), -- gpt-4o, claude-sonnet-4, etc.
    provider VARCHAR(50), -- openai, anthropic, bedrock
    quantity BIGINT NOT NULL, -- token count, API calls, etc.
    cost_usd NUMERIC(10, 6), -- Actual cost in USD
    metadata JSONB DEFAULT '{}', -- {request_id, prompt_tokens, completion_tokens, etc.}
    idempotency_key VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partitioning by month for performance
CREATE INDEX idx_usage_events_tenant_time ON usage_events(tenant_id, event_timestamp DESC);
CREATE INDEX idx_usage_events_customer_time ON usage_events(end_customer_id, event_timestamp DESC);
CREATE INDEX idx_usage_events_idempotency ON usage_events(idempotency_key);

-- ============================================
-- BILLING PERIODS & INVOICES
-- ============================================

CREATE TABLE billing_periods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, closed, finalized
    total_usage_cost NUMERIC(12, 2) DEFAULT 0.00,
    stripe_invoice_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    UNIQUE(tenant_id, start_date)
);

CREATE INDEX idx_billing_periods_tenant ON billing_periods(tenant_id, start_date DESC);

CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    billing_period_id UUID REFERENCES billing_periods(id),
    stripe_invoice_id VARCHAR(100) UNIQUE,
    invoice_number VARCHAR(50) UNIQUE,
    status VARCHAR(50) NOT NULL, -- draft, sent, paid, failed
    subtotal NUMERIC(12, 2) NOT NULL,
    tax NUMERIC(12, 2) DEFAULT 0.00,
    total NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    due_date DATE,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX idx_invoices_stripe ON invoices(stripe_invoice_id);

-- ============================================
-- PRICING PLANS
-- ============================================

CREATE TABLE pricing_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE, -- Starter, Growth, Scale
    slug VARCHAR(50) NOT NULL UNIQUE,
    base_price_monthly NUMERIC(10, 2) NOT NULL,
    base_price_yearly NUMERIC(10, 2),
    included_usage JSONB DEFAULT '{}', -- {"llm_tokens": 100000, "api_calls": 10000}
    overage_rates JSONB DEFAULT '{}', -- {"llm_tokens": 0.0001, "api_calls": 0.001}
    max_end_customers INTEGER,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- AGGREGATED USAGE (for dashboards)
-- ============================================

CREATE TABLE usage_daily_aggregates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    end_customer_id UUID NOT NULL REFERENCES end_customers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    model VARCHAR(100),
    total_quantity BIGINT NOT NULL DEFAULT 0,
    total_cost_usd NUMERIC(10, 6) NOT NULL DEFAULT 0.00,
    request_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, end_customer_id, date, event_type, model)
);

CREATE INDEX idx_usage_daily_tenant ON usage_daily_aggregates(tenant_id, date DESC);
CREATE INDEX idx_usage_daily_customer ON usage_daily_aggregates(end_customer_id, date DESC);

-- ============================================
-- WEBHOOKS (Stripe event tracking)
-- ============================================

CREATE TABLE webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider VARCHAR(50) NOT NULL, -- stripe
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT false,
    processed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_webhooks_processed ON webhook_events(processed, created_at);
CREATE INDEX idx_webhooks_event_id ON webhook_events(event_id);
```

### Row-Level Security (Multi-tenancy Isolation)

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE end_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their tenant's data
CREATE POLICY tenant_isolation_policy ON usage_events
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_policy ON end_customers
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Set tenant context in application
-- In FastAPI middleware:
-- await conn.execute("SET app.current_tenant_id = %s", [tenant_id])
```

---

## API Design

### Authentication Flow

```
1. User registers → POST /api/v1/auth/register
2. Email verification (optional for MVP)
3. User logs in → POST /api/v1/auth/login → Returns JWT
4. Frontend stores JWT in httpOnly cookie
5. Subsequent requests include JWT in Authorization header
```

### Core API Endpoints

```yaml
# Authentication
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
GET    /api/v1/auth/me

# Tenants
GET    /api/v1/tenants/current
PATCH  /api/v1/tenants/current
POST   /api/v1/tenants/api-keys
GET    /api/v1/tenants/api-keys
DELETE /api/v1/tenants/api-keys/:id

# End Customers (Multi-tenant)
GET    /api/v1/customers
POST   /api/v1/customers
GET    /api/v1/customers/:id
PATCH  /api/v1/customers/:id
DELETE /api/v1/customers/:id

# Usage Tracking (External API for customer apps)
POST   /api/v1/usage/track
GET    /api/v1/usage/summary?customer_id=xxx&start_date=xxx&end_date=xxx

# Billing
GET    /api/v1/billing/usage?period=current
GET    /api/v1/billing/invoices
GET    /api/v1/billing/invoices/:id
POST   /api/v1/billing/subscription
PATCH  /api/v1/billing/subscription

# Webhooks (Stripe)
POST   /api/v1/webhooks/stripe

# Health & Monitoring
GET    /health
GET    /metrics  # Prometheus format
```

### Sample Request/Response

**Track Usage Event**
```bash
POST /api/v1/usage/track
Authorization: Bearer uf_live_xxxxxxxxxxx
Content-Type: application/json

{
  "customer_id": "customer_123",
  "event_type": "llm_tokens",
  "model": "gpt-4o",
  "provider": "openai",
  "quantity": 1500,
  "cost_usd": 0.045,
  "metadata": {
    "request_id": "req_abc123",
    "prompt_tokens": 1000,
    "completion_tokens": 500
  },
  "idempotency_key": "req_abc123",
  "timestamp": "2024-12-24T10:30:00Z"
}
```

**Response**
```json
{
  "success": true,
  "event_id": "evt_xyz789",
  "customer_id": "customer_123",
  "quantity": 1500,
  "cost_usd": 0.045,
  "timestamp": "2024-12-24T10:30:00Z"
}
```

---

## LiteLLM Proxy Integration

### Deployment on ECS Fargate

**Dockerfile for LiteLLM**
```dockerfile
FROM ghcr.io/berriai/litellm:main-stable

# Copy config
COPY litellm_config.yaml /app/config.yaml

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s \
  CMD curl -f http://localhost:4000/health || exit 1

# Run proxy
CMD ["--config", "/app/config.yaml", "--port", "4000", "--num_workers", "4"]
```

**litellm_config.yaml**
```yaml
model_list:
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
  
  - model_name: claude-sonnet
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
  
  - model_name: bedrock-claude
    litellm_params:
      model: bedrock/anthropic.claude-3-sonnet-20240229-v1:0
      aws_region_name: us-east-1

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  database_url: os.environ/DATABASE_URL
  
  # Performance tuning
  proxy_batch_write_at: 60  # Batch writes every 60s
  database_connection_pool_limit: 10
  
  # Rate limiting with Redis
  redis_host: os.environ/REDIS_HOST
  redis_port: 6379
  
  # Request tracking
  success_callback: ["langfuse", "usageflow_webhook"]
  
  # Health checks
  health_check_interval: 300

litellm_settings:
  drop_params: true
  set_verbose: false
  
router_settings:
  routing_strategy: "simple-shuffle"
  num_retries: 3
  timeout: 300
  
# Custom callback to UsageFlow API
callbacks:
  - callback_name: "usageflow_webhook"
    callback_type: "success"
    callback_vars:
      url: "https://api.usageflow.com/api/v1/usage/track"
      headers:
        Authorization: "Bearer ${USAGEFLOW_API_KEY}"
```

### Custom Callback for Usage Tracking

```python
# litellm_callback.py
from litellm.integrations.custom_logger import CustomLogger
import httpx
import os

class UsageFlowLogger(CustomLogger):
    def __init__(self):
        self.api_url = os.getenv("USAGEFLOW_API_URL")
        self.api_key = os.getenv("USAGEFLOW_API_KEY")
    
    async def async_log_success_event(self, kwargs, response_obj, start_time, end_time):
        """Log successful LLM requests to UsageFlow"""
        try:
            # Extract metadata
            metadata = kwargs.get("metadata", {})
            customer_id = metadata.get("customer_id") or kwargs.get("user")
            
            if not customer_id:
                return  # Skip if no customer ID
            
            # Calculate cost
            usage = response_obj.get("usage", {})
            prompt_tokens = usage.get("prompt_tokens", 0)
            completion_tokens = usage.get("completion_tokens", 0)
            total_tokens = usage.get("total_tokens", 0)
            
            model = kwargs.get("model")
            cost = self._calculate_cost(model, prompt_tokens, completion_tokens)
            
            # Send to UsageFlow API
            payload = {
                "customer_id": customer_id,
                "event_type": "llm_tokens",
                "model": model,
                "provider": self._get_provider(model),
                "quantity": total_tokens,
                "cost_usd": cost,
                "metadata": {
                    "request_id": response_obj.get("id"),
                    "prompt_tokens": prompt_tokens,
                    "completion_tokens": completion_tokens,
                    "latency_ms": (end_time - start_time) * 1000
                },
                "idempotency_key": response_obj.get("id"),
                "timestamp": response_obj.get("created")
            }
            
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self.api_url}/usage/track",
                    json=payload,
                    headers={"Authorization": f"Bearer {self.api_key}"},
                    timeout=5.0
                )
        except Exception as e:
            print(f"UsageFlow logging error: {e}")
    
    def _calculate_cost(self, model, prompt_tokens, completion_tokens):
        """Calculate cost based on model pricing"""
        pricing = {
            "gpt-4o": {"prompt": 0.0025, "completion": 0.01},
            "gpt-4o-mini": {"prompt": 0.00015, "completion": 0.0006},
            "claude-sonnet-4": {"prompt": 0.003, "completion": 0.015},
        }
        
        model_pricing = pricing.get(model, {"prompt": 0.001, "completion": 0.002})
        cost = (prompt_tokens / 1000) * model_pricing["prompt"]
        cost += (completion_tokens / 1000) * model_pricing["completion"]
        return round(cost, 6)
    
    def _get_provider(self, model):
        """Extract provider from model name"""
        if "gpt" in model:
            return "openai"
        elif "claude" in model:
            return "anthropic"
        elif "bedrock" in model:
            return "bedrock"
        return "unknown"
```

---

## File Structure

```
usageflow/
├── backend/
│   ├── alembic/                    # Database migrations
│   │   ├── versions/
│   │   └── env.py
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # FastAPI app entry
│   │   ├── config.py               # Settings (from env vars)
│   │   ├── database.py             # SQLAlchemy setup
│   │   ├── dependencies.py         # FastAPI dependencies
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── v1/
│   │   │   │   ├── __init__.py
│   │   │   │   ├── auth.py
│   │   │   │   ├── tenants.py
│   │   │   │   ├── customers.py
│   │   │   │   ├── usage.py
│   │   │   │   ├── billing.py
│   │   │   │   └── webhooks.py
│   │   │
│   │   ├── models/                 # SQLAlchemy models
│   │   │   ├── __init__.py
│   │   │   ├── tenant.py
│   │   │   ├── user.py
│   │   │   ├── customer.py
│   │   │   ├── usage_event.py
│   │   │   ├── invoice.py
│   │   │   └── pricing_plan.py
│   │   │
│   │   ├── schemas/                # Pydantic schemas
│   │   │   ├── __init__.py
│   │   │   ├── auth.py
│   │   │   ├── tenant.py
│   │   │   ├── customer.py
│   │   │   ├── usage.py
│   │   │   └── billing.py
│   │   │
│   │   ├── services/               # Business logic
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── usage_service.py
│   │   │   ├── billing_service.py
│   │   │   ├── stripe_service.py
│   │   │   └── aggregation_service.py
│   │   │
│   │   ├── workers/                # Background jobs
│   │   │   ├── __init__.py
│   │   │   ├── invoice_generator.py
│   │   │   ├── usage_aggregator.py
│   │   │   └── webhook_processor.py
│   │   │
│   │   └── utils/
│   │       ├── __init__.py
│   │       ├── auth.py             # JWT handling
│   │       ├── tenant_context.py   # Multi-tenant isolation
│   │       └── idempotency.py      # Idempotency keys
│   │
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_usage_tracking.py
│   │   └── test_billing.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   └── alembic.ini
│
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   │
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── UsageChart.tsx
│   │   │   │   ├── CostBreakdown.tsx
│   │   │   │   └── CustomerList.tsx
│   │   │   └── billing/
│   │   │       ├── InvoiceList.tsx
│   │   │       └── SubscriptionManager.tsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Customers.tsx
│   │   │   ├── Usage.tsx
│   │   │   ├── Billing.tsx
│   │   │   └── Settings.tsx
│   │   │
│   │   ├── api/
│   │   │   └── client.ts           # Axios instance
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useUsage.ts
│   │   │   └── useBilling.ts
│   │   │
│   │   └── stores/
│   │       └── authStore.ts         # Zustand state
│   │
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── infrastructure/
│   ├── terraform/
│   │   ├── modules/
│   │   │   ├── networking/
│   │   │   │   ├── main.tf          # VPC, subnets, security groups
│   │   │   │   ├── variables.tf
│   │   │   │   └── outputs.tf
│   │   │   ├── ecs/
│   │   │   │   ├── main.tf          # ECS cluster, services, tasks
│   │   │   │   ├── variables.tf
│   │   │   │   └── outputs.tf
│   │   │   ├── rds/
│   │   │   │   ├── main.tf          # RDS PostgreSQL
│   │   │   │   ├── variables.tf
│   │   │   │   └── outputs.tf
│   │   │   ├── elasticache/
│   │   │   │   ├── main.tf          # Redis cluster
│   │   │   │   ├── variables.tf
│   │   │   │   └── outputs.tf
│   │   │   └── frontend/
│   │   │       ├── main.tf          # S3, CloudFront
│   │   │       ├── variables.tf
│   │   │       └── outputs.tf
│   │   │
│   │   ├── environments/
│   │   │   ├── dev/
│   │   │   │   ├── main.tf
│   │   │   │   └── terraform.tfvars
│   │   │   └── prod/
│   │   │       ├── main.tf
│   │   │       └── terraform.tfvars
│   │   │
│   │   └── main.tf                  # Root module
│   │
│   └── docker/
│       ├── backend/
│       │   └── Dockerfile
│       ├── litellm/
│       │   ├── Dockerfile
│       │   └── config.yaml
│       └── docker-compose.yml        # Local development
│
├── docs/
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── ARCHITECTURE.md
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── README.md
└── .gitignore
```

---

## Week-by-Week Implementation Roadmap

### **Weeks 1-2: Infrastructure Setup + Authentication**

**AWS Infrastructure (Terraform)**
- [ ] Set up VPC with public/private subnets (2 AZs)
- [ ] Create RDS PostgreSQL db.t4g.micro in private subnet
- [ ] Set up ElastiCache Redis in private subnet
- [ ] Configure security groups (DB access only from ECS, Redis from ECS)
- [ ] Create Application Load Balancer
- [ ] Set up Route 53 hosted zone
- [ ] Configure Secrets Manager for API keys
- [ ] Create S3 bucket for Terraform state

**Backend Foundation**
- [ ] Initialize FastAPI project structure
- [ ] Set up SQLAlchemy with async support
- [ ] Create Alembic migrations for auth tables (users, tenants)
- [ ] Implement JWT authentication
- [ ] Build registration/login endpoints
- [ ] Add password hashing (bcrypt)
- [ ] Create middleware for tenant context setting
- [ ] Write unit tests for auth

**Deliverable:** Working authentication API deployed to ECS Fargate

**Commands:**
```bash
# Infrastructure
cd infrastructure/terraform/environments/dev
terraform init
terraform plan
terraform apply

# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload
```

### **Weeks 3-4: Usage Event Tracking**

**Database Schema**
- [ ] Create tables: end_customers, usage_events, api_keys
- [ ] Add indexes for time-based queries
- [ ] Implement idempotency handling
- [ ] Set up row-level security policies

**API Development**
- [ ] POST /api/v1/usage/track endpoint
- [ ] Implement API key authentication
- [ ] Add Redis-based rate limiting (1000 req/min per tenant)
- [ ] Build idempotency check (Redis cache for 24hrs)
- [ ] Create background job for batch DB writes (SQS + Lambda)
- [ ] Add CloudWatch metrics for request latency, error rates

**Testing**
- [ ] Load test with Locust (1000 concurrent requests)
- [ ] Test idempotency (duplicate requests return same event_id)
- [ ] Verify multi-tenant isolation

**Deliverable:** Production-ready usage tracking API

**Sample Load Test:**
```python
# locustfile.py
from locust import HttpUser, task, between

class UsageTracker(HttpUser):
    wait_time = between(0.1, 0.5)
    
    @task
    def track_usage(self):
        self.client.post("/api/v1/usage/track", json={
            "customer_id": f"customer_{self.userId}",
            "event_type": "llm_tokens",
            "quantity": 1500,
            "idempotency_key": f"req_{self.userId}_{int(time.time())}"
        }, headers={"Authorization": "Bearer uf_test_xxx"})
```

### **Weeks 5-6: LiteLLM Proxy Integration**

**LiteLLM Deployment**
- [ ] Create Dockerfile for LiteLLM proxy
- [ ] Configure multi-model support (OpenAI, Anthropic, Bedrock)
- [ ] Set up database connection for cost tracking
- [ ] Deploy as separate ECS Fargate service
- [ ] Add health checks and auto-scaling (CPU > 70%)
- [ ] Implement custom callback for UsageFlow API

**Customer SDK**
- [ ] Create Python SDK for easy integration
- [ ] Add Node.js SDK
- [ ] Write integration guides

**Deliverable:** LiteLLM proxy routing requests and auto-tracking costs

**Python SDK Example:**
```python
# usageflow_sdk.py
from openai import OpenAI

client = OpenAI(
    base_url="https://litellm.usageflow.com/v1",
    api_key="uf_live_xxx"
)

response = client.chat.completions.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
    user="customer_123"  # Auto-tracked
)
```

### **Weeks 7-8: Billing & Stripe Integration**

**Stripe Setup**
- [ ] Create Stripe Meters for token usage
- [ ] Set up webhook endpoints
- [ ] Implement subscription creation flow
- [ ] Build invoice generation logic
- [ ] Add failed payment handling

**Billing Service**
- [ ] Create daily aggregation job (EventBridge cron)
- [ ] Build usage summary endpoints
- [ ] Implement usage overage calculations
- [ ] Add invoice preview functionality

**Database**
- [ ] Create tables: billing_periods, invoices, pricing_plans
- [ ] Add materialized view for daily aggregates

**Deliverable:** End-to-end billing flow (usage → aggregation → Stripe invoice)

### **Weeks 9-11: Frontend Dashboard**

**Core Pages**
- [ ] Login/Register pages
- [ ] Dashboard with usage charts (Recharts)
- [ ] Customer management (CRUD)
- [ ] Usage history with filters
- [ ] Billing & invoices page
- [ ] Settings (API keys, subscription)

**Components**
- [ ] Responsive layout with sidebar navigation
- [ ] Real-time usage chart (SSE or polling)
- [ ] Cost breakdown by customer/model
- [ ] Invoice download (PDF generation via Lambda)

**State Management**
- [ ] Zustand store for auth
- [ ] React Query for data fetching
- [ ] Optimistic updates for better UX

**Deployment**
- [ ] Build with Vite
- [ ] Upload to S3
- [ ] Configure CloudFront distribution
- [ ] Set up SSL certificate (ACM)

**Deliverable:** Fully functional dashboard deployed to S3+CloudFront

### **Weeks 12-13: Testing, Documentation & Launch Prep**

**Testing**
- [ ] End-to-end tests with Playwright
- [ ] Load testing (10K requests/min sustained)
- [ ] Security audit (OWASP top 10)
- [ ] Penetration testing (basic)

**Documentation**
- [ ] API reference (auto-generated from OpenAPI)
- [ ] Integration guides (Python, Node.js, curl)
- [ ] Architecture documentation
- [ ] Deployment runbooks

**Launch Prep**
- [ ] Set up monitoring dashboards (CloudWatch)
- [ ] Configure alerts (CPU > 80%, error rate > 1%)
- [ ] Create backup strategy (RDS automated backups + manual snapshots)
- [ ] Write incident response plan

**Deliverable:** Production-ready system with full documentation

---

## Deployment Strategy

### CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to AWS

on:
  push:
    branches: [main]

jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to ECR
        run: |
          aws ecr get-login-password --region us-east-1 | \
          docker login --username AWS --password-stdin ${{ secrets.ECR_REGISTRY }}
      
      - name: Build and push backend
        run: |
          cd backend
          docker build -t usageflow-api:${{ github.sha }} .
          docker tag usageflow-api:${{ github.sha }} ${{ secrets.ECR_REGISTRY }}/usageflow-api:latest
          docker push ${{ secrets.ECR_REGISTRY }}/usageflow-api:latest
      
      - name: Update ECS service
        run: |
          aws ecs update-service \
            --cluster usageflow-prod \
            --service api-service \
            --force-new-deployment
  
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - name: Build frontend
        run: |
          cd frontend
          npm ci
          npm run build
      
      - name: Deploy to S3
        run: |
          aws s3 sync frontend/dist s3://usageflow-frontend --delete
      
      - name: Invalidate CloudFront
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DIST_ID }} \
            --paths "/*"
```

### Database Migration Strategy

```bash
# Run migrations before deployment
alembic upgrade head

# Rollback if issues
alembic downgrade -1
```

**Zero-downtime deployments:**
1. Deploy new ECS task definition
2. Wait for health checks to pass
3. Drain old tasks
4. Route traffic to new tasks

---

## Monitoring & Observability

### CloudWatch Dashboards

**Metrics to Track:**
- Request latency (p50, p95, p99)
- Error rate (4xx, 5xx)
- Database connection pool usage
- Redis hit/miss ratio
- ECS CPU/memory utilization
- SQS queue depth

**Alarms:**
```hcl
resource "aws_cloudwatch_metric_alarm" "api_high_error_rate" {
  alarm_name          = "usageflow-api-high-error-rate"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "5XXError"
  namespace           = "AWS/ApplicationELB"
  period              = "60"
  statistic           = "Sum"
  threshold           = "10"
  alarm_description   = "Alert if API returns >10 5XX errors in 2 minutes"
  alarm_actions       = [aws_sns_topic.alerts.arn]
}
```

### Structured Logging

```python
import structlog

logger = structlog.get_logger()

logger.info(
    "usage_event_tracked",
    tenant_id=tenant_id,
    customer_id=customer_id,
    quantity=quantity,
    cost_usd=cost,
    latency_ms=latency
)
```

**CloudWatch Insights Queries:**
```sql
-- Average cost per customer
fields @timestamp, customer_id, cost_usd
| stats avg(cost_usd) by customer_id
| sort avg(cost_usd) desc

-- Request latency percentiles
fields @timestamp, latency_ms
| stats pct(latency_ms, 50), pct(latency_ms, 95), pct(latency_ms, 99)
```

---

## Security Best Practices

### 1. Secrets Management

**Never hardcode secrets.** Use AWS Secrets Manager:

```python
import boto3
import json

def get_secret(secret_name):
    client = boto3.client('secretsmanager', region_name='us-east-1')
    response = client.get_secret_value(SecretId=secret_name)
    return json.loads(response['SecretString'])

# In app startup
secrets = get_secret('usageflow/prod/api-keys')
STRIPE_API_KEY = secrets['stripe_api_key']
```

### 2. API Key Security

**Generate secure keys:**
```python
import secrets

def generate_api_key(prefix="uf_live"):
    random_part = secrets.token_urlsafe(32)
    return f"{prefix}_{random_part}"
```

**Store hashed:**
```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

hashed_key = pwd_context.hash(api_key)
# Store only hashed_key in database
```

### 3. SQL Injection Prevention

**Always use parameterized queries:**
```python
# GOOD
result = await db.execute(
    "SELECT * FROM usage_events WHERE tenant_id = :tenant_id",
    {"tenant_id": tenant_id}
)

# BAD - Never do this
result = await db.execute(
    f"SELECT * FROM usage_events WHERE tenant_id = '{tenant_id}'"
)
```

### 4. Rate Limiting

```python
from fastapi import Request
from fastapi.responses import JSONResponse
import redis

redis_client = redis.Redis(host='redis', port=6379)

async def rate_limit_middleware(request: Request, call_next):
    api_key = request.headers.get("Authorization", "").replace("Bearer ", "")
    
    # Allow 1000 requests per minute
    key = f"rate_limit:{api_key}"
    current = redis_client.incr(key)
    
    if current == 1:
        redis_client.expire(key, 60)
    
    if current > 1000:
        return JSONResponse(
            status_code=429,
            content={"error": "Rate limit exceeded"}
        )
    
    response = await call_next(request)
    return response
```

---

## Cost Optimization Tips

### 1. Use Spot Instances for Background Jobs

```hcl
resource "aws_ecs_capacity_provider" "spot" {
  name = "usageflow-spot"
  
  auto_scaling_group_provider {
    auto_scaling_group_arn = aws_autoscaling_group.spot.arn
    
    managed_scaling {
      maximum_scaling_step_size = 10
      minimum_scaling_step_size = 1
      status                    = "ENABLED"
      target_capacity          = 100
    }
  }
}
```

**Savings:** 70-90% for non-critical workloads

### 2. Enable Aurora Serverless Auto-Pause

If using Aurora instead of RDS:
```hcl
resource "aws_rds_cluster" "main" {
  engine_mode = "serverless"
  
  scaling_configuration {
    auto_pause               = true
    min_capacity             = 0.5
    max_capacity             = 1
    seconds_until_auto_pause = 300
  }
}
```

**Savings:** ~$50/month during low-traffic periods

### 3. Use S3 Intelligent Tiering

```hcl
resource "aws_s3_bucket_intelligent_tiering_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id
  name   = "EntireBucket"
  
  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }
}
```

### 4. CloudFront Caching

```hcl
cache_behavior {
  path_pattern     = "/static/*"
  allowed_methods  = ["GET", "HEAD"]
  cached_methods   = ["GET", "HEAD"]
  target_origin_id = "S3-Origin"
  
  forwarded_values {
    query_string = false
    cookies {
      forward = "none"
    }
  }
  
  min_ttl     = 3600
  default_ttl = 86400
  max_ttl     = 31536000
}
```

**Savings:** 80% reduction in S3 requests

---

## Next Steps for Week 1

1. **Set up AWS account structure**
   ```bash
   aws configure
   aws s3 mb s3://usageflow-terraform-state
   aws s3api put-bucket-versioning --bucket usageflow-terraform-state --versioning-configuration Status=Enabled
   ```

2. **Initialize Terraform**
   ```bash
   cd infrastructure/terraform
   terraform init
   terraform plan
   ```

3. **Create backend project**
   ```bash
   mkdir -p backend/app/{api/v1,models,schemas,services,workers,utils}
   cd backend
   python -m venv venv
   source venv/bin/activate
   pip install fastapi uvicorn sqlalchemy alembic psycopg2-binary pydantic stripe redis
   pip freeze > requirements.txt
   ```

4. **Set up GitHub repo**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create usageflow --private
   git push -u origin main
   ```

Ready to start building? Let me know which part you'd like me to dive deeper into - database schemas, FastAPI code, Terraform configs, or frontend components!
