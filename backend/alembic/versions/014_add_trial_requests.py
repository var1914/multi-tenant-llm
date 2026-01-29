"""add trial requests table

Revision ID: 014
Revises: 013
Create Date: 2026-01-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '014'
down_revision = '013'
branch_labels = None
depends_on = None


def upgrade():
    # Create enum type for trial request status (skip if already exists)
    bind = op.get_bind()
    bind.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE trialrequeststatus AS ENUM ('pending', 'approved', 'rejected'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$;"
    ))

    # Create trial_requests table
    # Use postgresql.ENUM with create_type=False since we already created it above
    status_enum = postgresql.ENUM('pending', 'approved', 'rejected', name='trialrequeststatus', create_type=False)
    op.create_table(
        'trial_requests',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=False),
        sa.Column('company_name', sa.String(255), nullable=True),
        sa.Column('use_case', sa.Text(), nullable=False),
        sa.Column('status', status_enum, nullable=False, server_default='pending'),
        sa.Column('admin_notes', sa.Text(), nullable=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient lookups
    op.create_index('ix_trial_requests_email', 'trial_requests', ['email'])
    op.create_index('ix_trial_requests_status', 'trial_requests', ['status'])
    op.create_index('ix_trial_requests_created_at', 'trial_requests', ['created_at'])


def downgrade():
    op.drop_index('ix_trial_requests_created_at', table_name='trial_requests')
    op.drop_index('ix_trial_requests_status', table_name='trial_requests')
    op.drop_index('ix_trial_requests_email', table_name='trial_requests')
    op.drop_table('trial_requests')

    # Drop the enum type
    trial_status_enum = postgresql.ENUM('pending', 'approved', 'rejected', name='trialrequeststatus')
    trial_status_enum.drop(op.get_bind(), checkfirst=True)
