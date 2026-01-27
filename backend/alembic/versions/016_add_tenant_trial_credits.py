"""add trial credits column to tenants

Revision ID: 016
Revises: 015
Create Date: 2026-01-26 23:00:00.000000

Adds trial_credits_usd column to track $5 trial credits
given to users who register with approved trial requests.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '016'
down_revision = '015'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('tenants', sa.Column(
        'trial_credits_usd',
        sa.Numeric(10, 2),
        server_default='0',
        nullable=False
    ))


def downgrade():
    op.drop_column('tenants', 'trial_credits_usd')
