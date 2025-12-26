"""Add billing periods table

Revision ID: 005
Revises: 004
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '005'
down_revision = '004'
branch_labels = None
depends_on = None


def upgrade():
    # Create billing_periods table for tracking monthly usage and billing
    op.create_table(
        'billing_periods',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('period_start', sa.DateTime(timezone=True), nullable=False),
        sa.Column('period_end', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.String(20), server_default='active'),  # active, closed, invoiced

        # Usage summary for the period
        sa.Column('total_tokens_used', sa.BigInteger(), server_default='0'),
        sa.Column('included_tokens', sa.BigInteger(), nullable=False),  # From their plan
        sa.Column('overage_tokens', sa.BigInteger(), server_default='0'),

        # Costs
        sa.Column('base_cost_usd', sa.Numeric(12, 2), nullable=False),  # Plan price
        sa.Column('overage_cost_usd', sa.Numeric(12, 2), server_default='0'),
        sa.Column('total_cost_usd', sa.Numeric(12, 2), nullable=False),

        # Stripe billing
        sa.Column('stripe_invoice_id', sa.String(100), nullable=True),
        sa.Column('stripe_payment_intent_id', sa.String(100), nullable=True),
        sa.Column('payment_status', sa.String(50), nullable=True),  # pending, paid, failed
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),

        # Metadata
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('idx_billing_periods_tenant', 'billing_periods', ['tenant_id'])
    op.create_index('idx_billing_periods_dates', 'billing_periods', ['period_start', 'period_end'])
    op.create_index('idx_billing_periods_status', 'billing_periods', ['status'])
    op.create_unique_constraint(
        'uq_billing_period_tenant_start',
        'billing_periods',
        ['tenant_id', 'period_start']
    )


def downgrade():
    op.drop_constraint('uq_billing_period_tenant_start', 'billing_periods', type_='unique')
    op.drop_index('idx_billing_periods_status')
    op.drop_index('idx_billing_periods_dates')
    op.drop_index('idx_billing_periods_tenant')
    op.drop_table('billing_periods')
