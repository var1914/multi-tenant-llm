"""Add pricing plans table

Revision ID: 004
Revises: 003
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '004'
down_revision = '003'
branch_labels = None
depends_on = None


def upgrade():
    # Create pricing_plans table
    op.create_table(
        'pricing_plans',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(50), nullable=False, unique=True),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('price_monthly_usd', sa.Numeric(10, 2), nullable=False),
        sa.Column('price_yearly_usd', sa.Numeric(10, 2), nullable=True),
        sa.Column('included_tokens', sa.BigInteger(), nullable=False),
        sa.Column('overage_price_per_1k_tokens', sa.Numeric(10, 6), nullable=False),
        sa.Column('max_customers', sa.Integer(), nullable=True),  # NULL = unlimited
        sa.Column('max_api_keys', sa.Integer(), nullable=True),  # NULL = unlimited
        sa.Column('features', sa.JSON(), nullable=True),  # JSON array of feature flags
        sa.Column('stripe_price_id_monthly', sa.String(100), nullable=True),
        sa.Column('stripe_price_id_yearly', sa.String(100), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('sort_order', sa.Integer(), server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_pricing_plans_slug', 'pricing_plans', ['slug'])
    op.create_index('idx_pricing_plans_active', 'pricing_plans', ['is_active'])

    # Add new columns to tenants table
    # Note: stripe_customer_id, stripe_subscription_id, subscription_status already exist from 001
    op.add_column('tenants', sa.Column('current_plan_id', UUID(as_uuid=True), nullable=True))
    op.add_column('tenants', sa.Column('subscription_period_end', sa.DateTime(timezone=True), nullable=True))

    op.create_foreign_key(
        'fk_tenants_pricing_plan',
        'tenants', 'pricing_plans',
        ['current_plan_id'], ['id'],
        ondelete='SET NULL'
    )

    # Seed default pricing plans
    op.execute("""
        INSERT INTO pricing_plans (name, slug, description, price_monthly_usd, price_yearly_usd, included_tokens, overage_price_per_1k_tokens, max_customers, max_api_keys, features, sort_order)
        VALUES
        (
            'Starter',
            'starter',
            'Perfect for small teams getting started with LLM billing',
            299.00,
            2990.00,
            1000000,
            0.002000,
            10,
            5,
            '["basic_analytics", "email_support", "csv_export"]',
            1
        ),
        (
            'Growth',
            'growth',
            'For growing teams with higher usage needs',
            699.00,
            6990.00,
            5000000,
            0.001500,
            50,
            20,
            '["advanced_analytics", "priority_support", "csv_export", "api_access", "custom_alerts"]',
            2
        ),
        (
            'Scale',
            'scale',
            'For large organizations with enterprise needs',
            1299.00,
            12990.00,
            20000000,
            0.001000,
            NULL,
            NULL,
            '["advanced_analytics", "dedicated_support", "csv_export", "api_access", "custom_alerts", "sso", "audit_logs", "custom_integrations"]',
            3
        );
    """)


def downgrade():
    op.drop_constraint('fk_tenants_pricing_plan', 'tenants', type_='foreignkey')
    op.drop_column('tenants', 'subscription_period_end')
    op.drop_column('tenants', 'current_plan_id')

    op.drop_index('idx_pricing_plans_active')
    op.drop_index('idx_pricing_plans_slug')
    op.drop_table('pricing_plans')
