"""Add outcome pricing and agent efficiency tables

Revision ID: 010
Revises: 009
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '010'
down_revision = '009'
branch_labels = None
depends_on = None


def upgrade():
    # Create outcome_pricing table
    op.create_table(
        'outcome_pricing',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('workflow_type', sa.String(100), nullable=False),
        sa.Column('billing_model', sa.String(50), nullable=False),  # per_outcome, tiered_outcome
        sa.Column('price_per_success', sa.Numeric(12, 6), nullable=True),
        sa.Column('free_attempts', sa.Integer, default=0),
        sa.Column('tiers', JSONB, default=dict),  # For tiered pricing
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Unique constraint for tenant + workflow_type
    op.create_unique_constraint(
        'uq_outcome_pricing_tenant_workflow_type',
        'outcome_pricing',
        ['tenant_id', 'workflow_type']
    )

    # Create agent_efficiency table for precomputed metrics
    op.create_table(
        'agent_efficiency',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('agent_name', sa.String(100), nullable=False),
        sa.Column('period_start', sa.Date, nullable=False),
        sa.Column('period_end', sa.Date, nullable=False),
        sa.Column('total_invocations', sa.Integer, default=0),
        sa.Column('successful_invocations', sa.Integer, default=0),
        sa.Column('total_tokens', sa.BigInteger, default=0),
        sa.Column('total_cost_usd', sa.Numeric(12, 6), default=0),
        sa.Column('avg_cost_per_call', sa.Numeric(12, 6), nullable=True),
        sa.Column('success_rate', sa.Numeric(5, 2), nullable=True),
        sa.Column('efficiency_score', sa.Integer, nullable=True),  # 0-100
        sa.Column('recommendations', JSONB, default=list),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # Unique constraint for tenant + agent_name + period
    op.create_unique_constraint(
        'uq_agent_efficiency_tenant_agent_period',
        'agent_efficiency',
        ['tenant_id', 'agent_name', 'period_start']
    )

    # Indexes
    op.create_index('idx_outcome_pricing_tenant', 'outcome_pricing', ['tenant_id'])
    op.create_index('idx_outcome_pricing_active', 'outcome_pricing', ['tenant_id', 'is_active'])
    op.create_index('idx_agent_efficiency_tenant', 'agent_efficiency', ['tenant_id'])
    op.create_index('idx_agent_efficiency_period', 'agent_efficiency', ['tenant_id', 'period_start', 'period_end'])


def downgrade():
    op.drop_index('idx_agent_efficiency_period', table_name='agent_efficiency')
    op.drop_index('idx_agent_efficiency_tenant', table_name='agent_efficiency')
    op.drop_index('idx_outcome_pricing_active', table_name='outcome_pricing')
    op.drop_index('idx_outcome_pricing_tenant', table_name='outcome_pricing')
    op.drop_constraint('uq_agent_efficiency_tenant_agent_period', 'agent_efficiency', type_='unique')
    op.drop_constraint('uq_outcome_pricing_tenant_workflow_type', 'outcome_pricing', type_='unique')
    op.drop_table('agent_efficiency')
    op.drop_table('outcome_pricing')
