"""Add customer budget fields

Revision ID: 002
Revises: 001
Create Date: 2024-12-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('end_customers', sa.Column('budget_limit_usd', sa.Numeric(12, 6), nullable=True))
    op.add_column('end_customers', sa.Column('budget_alert_threshold', sa.Numeric(5, 2), server_default='80', nullable=True))
    op.add_column('end_customers', sa.Column('budget_alert_enabled', sa.Boolean(), server_default='true', nullable=True))


def downgrade():
    op.drop_column('end_customers', 'budget_alert_enabled')
    op.drop_column('end_customers', 'budget_alert_threshold')
    op.drop_column('end_customers', 'budget_limit_usd')
