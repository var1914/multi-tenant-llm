"""add routellm settings and tracking columns

Revision ID: 015
Revises: 014
Create Date: 2026-01-26 15:00:00.000000

Adds RouteLLM ML-based routing settings to tenants table
and tracking columns to routing_decisions table.
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '015'
down_revision = '014'
branch_labels = None
depends_on = None


def upgrade():
    # Add RouteLLM columns to tenants table
    op.add_column('tenants', sa.Column(
        'routellm_enabled',
        sa.Boolean(),
        server_default='false',
        nullable=False
    ))
    op.add_column('tenants', sa.Column(
        'routellm_threshold',
        sa.Numeric(5, 5),
        server_default='0.11593',
        nullable=False
    ))
    op.add_column('tenants', sa.Column(
        'cascade_routing_enabled',
        sa.Boolean(),
        server_default='false',
        nullable=False
    ))

    # Add RouteLLM tracking columns to routing_decisions
    op.add_column('routing_decisions', sa.Column(
        'routellm_win_rate',
        sa.Numeric(5, 4),
        nullable=True
    ))
    op.add_column('routing_decisions', sa.Column(
        'routellm_used',
        sa.Boolean(),
        server_default='false',
        nullable=False
    ))
    op.add_column('routing_decisions', sa.Column(
        'routellm_confident',
        sa.Boolean(),
        server_default='false',
        nullable=False
    ))

    # Add index for RouteLLM analytics queries
    op.create_index(
        'idx_routing_decisions_routellm',
        'routing_decisions',
        ['routellm_used', 'routellm_confident'],
        unique=False
    )


def downgrade():
    # Drop index
    op.drop_index('idx_routing_decisions_routellm', table_name='routing_decisions')

    # Drop routing_decisions columns
    op.drop_column('routing_decisions', 'routellm_confident')
    op.drop_column('routing_decisions', 'routellm_used')
    op.drop_column('routing_decisions', 'routellm_win_rate')

    # Drop tenants columns
    op.drop_column('tenants', 'cascade_routing_enabled')
    op.drop_column('tenants', 'routellm_threshold')
    op.drop_column('tenants', 'routellm_enabled')
