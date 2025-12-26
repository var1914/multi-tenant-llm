"""Add smart routing tables

Revision ID: 006
Revises: 005
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = '006'
down_revision = '005'
branch_labels = None
depends_on = None


def upgrade():
    # Add smart routing columns to tenants table
    op.add_column('tenants', sa.Column('smart_routing_enabled', sa.Boolean(), server_default='false'))
    op.add_column('tenants', sa.Column('routing_strategy', sa.String(50), server_default='cost_optimized'))

    # Create routing_decisions table to track routing decisions
    op.create_table(
        'routing_decisions',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('end_customer_id', UUID(as_uuid=True), sa.ForeignKey('end_customers.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_timestamp', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('original_model', sa.String(100), nullable=False),
        sa.Column('routed_model', sa.String(100), nullable=False),
        sa.Column('routing_applied', sa.Boolean(), default=False),
        sa.Column('routing_reason', sa.Text(), nullable=True),
        sa.Column('complexity_score', sa.Numeric(5, 2), nullable=True),
        sa.Column('complexity_reasons', JSONB, server_default='[]'),
        sa.Column('estimated_savings_usd', sa.Numeric(10, 6), default=0),
        sa.Column('actual_tokens', sa.BigInteger(), nullable=True),
        sa.Column('actual_cost_usd', sa.Numeric(10, 6), nullable=True),
        sa.Column('request_id', sa.String(100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_index('idx_routing_tenant_time', 'routing_decisions', ['tenant_id', 'event_timestamp'])
    op.create_index('idx_routing_models', 'routing_decisions', ['original_model', 'routed_model'])


def downgrade():
    op.drop_index('idx_routing_models')
    op.drop_index('idx_routing_tenant_time')
    op.drop_table('routing_decisions')

    op.drop_column('tenants', 'routing_strategy')
    op.drop_column('tenants', 'smart_routing_enabled')
