"""Add page_views table for landing page analytics.

Revision ID: 017
Revises: 016
Create Date: 2026-01-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '017'
down_revision = '016'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'page_views',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('page_path', sa.String(500), nullable=False),
        sa.Column('referrer', sa.String(1000), nullable=True),
        sa.Column('utm_source', sa.String(255), nullable=True),
        sa.Column('utm_medium', sa.String(255), nullable=True),
        sa.Column('visitor_id', sa.String(64), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_index('idx_page_views_path_created', 'page_views', ['page_path', 'created_at'])
    op.create_index('idx_page_views_visitor_path', 'page_views', ['visitor_id', 'page_path', 'created_at'])
    op.create_index('idx_page_views_created', 'page_views', ['created_at'])


def downgrade():
    op.drop_index('idx_page_views_created', table_name='page_views')
    op.drop_index('idx_page_views_visitor_path', table_name='page_views')
    op.drop_index('idx_page_views_path_created', table_name='page_views')
    op.drop_table('page_views')
