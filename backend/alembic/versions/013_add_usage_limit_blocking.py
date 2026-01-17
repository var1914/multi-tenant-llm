"""add usage limit blocking

Revision ID: 013
Revises: 012
Create Date: 2026-01-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '013'
down_revision = '012'
branch_labels = None
depends_on = None


def upgrade():
    # Add budget_block_on_limit column to end_customers table
    # When True, requests will be blocked when budget is exceeded
    # When False, requests continue but alerts are sent
    op.add_column('end_customers',
        sa.Column('budget_block_on_limit', sa.Boolean(), nullable=False, server_default='false')
    )

    # Add index for faster lookups during request validation
    op.create_index(
        'ix_end_customers_budget_block',
        'end_customers',
        ['tenant_id', 'budget_block_on_limit'],
        unique=False
    )


def downgrade():
    op.drop_index('ix_end_customers_budget_block', table_name='end_customers')
    op.drop_column('end_customers', 'budget_block_on_limit')
