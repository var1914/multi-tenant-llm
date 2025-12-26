"""Add alerts table

Revision ID: 003
Revises: 002
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'alerts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('uuid_generate_v4()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('customer_id', sa.String(255), nullable=False),
        sa.Column('alert_type', sa.String(50), nullable=False),
        sa.Column('message', sa.String(1000), nullable=False),
        sa.Column('threshold_percentage', sa.Float(), nullable=False),
        sa.Column('current_spend_usd', sa.Numeric(12, 6), nullable=False),
        sa.Column('budget_limit_usd', sa.Numeric(12, 6), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('idx_alerts_tenant', 'alerts', ['tenant_id'])
    op.create_index('idx_alerts_customer', 'alerts', ['customer_id'])
    op.create_index('idx_alerts_created', 'alerts', ['created_at'])


def downgrade():
    op.drop_index('idx_alerts_created')
    op.drop_index('idx_alerts_customer')
    op.drop_index('idx_alerts_tenant')
    op.drop_table('alerts')
