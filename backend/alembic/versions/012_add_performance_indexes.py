"""Add performance indexes for 1000+ users

Revision ID: 012
Revises: 011
Create Date: 2025-01-16

This migration adds additional indexes optimized for common query patterns
at scale. These indexes support:
- Dashboard aggregation queries
- Customer billing lookups
- Workflow analytics
- Multi-tenant filtering

Note: Using regular CREATE INDEX (not CONCURRENTLY) since CONCURRENTLY
cannot run inside a transaction block. For production with existing data,
consider running these indexes manually outside of Alembic.
"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '012'
down_revision = '011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================================================
    # TENANTS TABLE
    # ==========================================================================

    # Index for active subscription lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tenants_subscription_status
        ON tenants (subscription_status)
        WHERE subscription_status IN ('active', 'trialing');
    """)

    # Index for billing period lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_tenants_subscription_period_end
        ON tenants (subscription_period_end)
        WHERE subscription_period_end IS NOT NULL;
    """)

    # ==========================================================================
    # END_CUSTOMERS TABLE
    # ==========================================================================

    # Composite index for customer lookup by tenant + external_id (common API pattern)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_end_customers_tenant_external
        ON end_customers (tenant_id, external_id);
    """)

    # Index for budget alerts (customers approaching limits)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_end_customers_budget_alert
        ON end_customers (tenant_id, budget_alert_enabled, budget_limit_usd)
        WHERE budget_alert_enabled = true AND budget_limit_usd IS NOT NULL;
    """)

    # Index for workflow budget enforcement
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_end_customers_workflow_budget
        ON end_customers (tenant_id, workflow_budget_usd)
        WHERE workflow_budget_usd IS NOT NULL;
    """)

    # Text search index on customer name (for search functionality)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_end_customers_name_trgm
        ON end_customers USING gin (name gin_trgm_ops);
    """)

    # ==========================================================================
    # ROUTING_DECISIONS TABLE
    # ==========================================================================

    # Index for routing analytics (by model pair)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_routing_decisions_models
        ON routing_decisions (tenant_id, original_model, routed_model, event_timestamp DESC);
    """)

    # Index for savings calculation queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_routing_decisions_savings
        ON routing_decisions (tenant_id, event_timestamp DESC)
        WHERE routing_applied = true AND estimated_savings_usd > 0;
    """)

    # ==========================================================================
    # AGENT_WORKFLOWS TABLE
    # ==========================================================================

    # Index for active workflow monitoring
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_workflows_active
        ON agent_workflows (tenant_id, status, started_at DESC)
        WHERE status IN ('running', 'paused');
    """)

    # Index for workflow analytics by customer
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_workflows_customer_analytics
        ON agent_workflows (end_customer_id, started_at DESC)
        WHERE end_customer_id IS NOT NULL;
    """)

    # Index for budget exceeded workflows
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_workflows_budget_exceeded
        ON agent_workflows (tenant_id, budget_exceeded, started_at DESC)
        WHERE budget_exceeded = true;
    """)

    # ==========================================================================
    # WORKFLOW_STEPS TABLE
    # ==========================================================================

    # Index for step analytics by agent type
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_workflow_steps_agent_analytics
        ON workflow_steps (tenant_id, agent_name, agent_type, started_at DESC);
    """)

    # Index for failed step investigation
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_workflow_steps_failed
        ON workflow_steps (tenant_id, status, started_at DESC)
        WHERE status = 'failed';
    """)

    # ==========================================================================
    # BILLING_PERIODS TABLE
    # ==========================================================================

    # Index for active billing period lookup
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_billing_periods_active
        ON billing_periods (tenant_id, status)
        WHERE status = 'active';
    """)

    # Index for overdue payments
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_billing_periods_payment_pending
        ON billing_periods (tenant_id, payment_status, period_end)
        WHERE payment_status IN ('pending', 'failed');
    """)

    # ==========================================================================
    # PREDICTION_ALERTS TABLE
    # ==========================================================================

    # Index for active alerts that need attention
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_prediction_alerts_active
        ON prediction_alerts (tenant_id, status, created_at DESC)
        WHERE status = 'active';
    """)

    # Index for alerts by customer
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_prediction_alerts_customer
        ON prediction_alerts (end_customer_id, alert_type, created_at DESC);
    """)

    # ==========================================================================
    # ALERTS TABLE
    # ==========================================================================

    # Index for pending alerts that need to be sent
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_alerts_pending
        ON alerts (status, created_at)
        WHERE status = 'pending';
    """)

    # ==========================================================================
    # API_KEYS TABLE
    # ==========================================================================

    # Index for API key authentication (most critical lookup)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_api_keys_auth
        ON api_keys (key_hash, is_active)
        WHERE is_active = true;
    """)

    # Index for listing keys by tenant
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_api_keys_tenant_list
        ON api_keys (tenant_id, environment, created_at DESC);
    """)

    # ==========================================================================
    # AGENT_EFFICIENCY TABLE (Pre-aggregated metrics)
    # ==========================================================================

    # Index for efficiency dashboard queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_agent_efficiency_dashboard
        ON agent_efficiency (tenant_id, period_start DESC, agent_name);
    """)

    # ==========================================================================
    # OUTCOME_PRICING TABLE
    # ==========================================================================

    # Index for active pricing lookups
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_outcome_pricing_active
        ON outcome_pricing (tenant_id, workflow_type, is_active)
        WHERE is_active = true;
    """)


def downgrade() -> None:
    # Drop all indexes created in upgrade
    indexes = [
        # tenants
        'idx_tenants_subscription_status',
        'idx_tenants_subscription_period_end',
        # end_customers
        'idx_end_customers_tenant_external',
        'idx_end_customers_budget_alert',
        'idx_end_customers_workflow_budget',
        'idx_end_customers_name_trgm',
        # routing_decisions
        'idx_routing_decisions_models',
        'idx_routing_decisions_savings',
        # agent_workflows
        'idx_agent_workflows_active',
        'idx_agent_workflows_customer_analytics',
        'idx_agent_workflows_budget_exceeded',
        # workflow_steps
        'idx_workflow_steps_agent_analytics',
        'idx_workflow_steps_failed',
        # billing_periods
        'idx_billing_periods_active',
        'idx_billing_periods_payment_pending',
        # prediction_alerts
        'idx_prediction_alerts_active',
        'idx_prediction_alerts_customer',
        # alerts
        'idx_alerts_pending',
        # api_keys
        'idx_api_keys_auth',
        'idx_api_keys_tenant_list',
        # agent_efficiency
        'idx_agent_efficiency_dashboard',
        # outcome_pricing
        'idx_outcome_pricing_active',
    ]

    for idx in indexes:
        op.execute(f"DROP INDEX IF EXISTS {idx};")
