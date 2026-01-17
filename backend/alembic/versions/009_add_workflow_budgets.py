"""Add workflow budget fields to end_customers

Revision ID: 009
Revises: 008
Create Date: 2024-01-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

# revision identifiers, used by Alembic.
revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None


def upgrade():
    # Add workflow budget fields to end_customers
    op.add_column('end_customers', sa.Column('workflow_budget_usd', sa.Numeric(12, 6), nullable=True))
    op.add_column('end_customers', sa.Column('workflow_budget_action', sa.String(50), server_default='alert', nullable=False))

    # Add index for quick budget lookups
    op.create_index('idx_end_customers_workflow_budget', 'end_customers', ['workflow_budget_usd'], postgresql_where=sa.text('workflow_budget_usd IS NOT NULL'))


def downgrade():
    op.drop_index('idx_end_customers_workflow_budget', table_name='end_customers')
    op.drop_column('end_customers', 'workflow_budget_action')
    op.drop_column('end_customers', 'workflow_budget_usd')
