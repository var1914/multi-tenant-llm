"""Add is_demo flag to tenants table for read-only demo mode.

Revision ID: 018
Revises: 017
Create Date: 2026-01-31
"""
from alembic import op
import sqlalchemy as sa

revision = '018'
down_revision = '017'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        'tenants',
        sa.Column('is_demo', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade():
    op.drop_column('tenants', 'is_demo')
