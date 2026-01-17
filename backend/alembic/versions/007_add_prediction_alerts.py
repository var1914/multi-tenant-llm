"""Add prediction alerts table

Revision ID: 007
Revises: 006
Create Date: 2024-12-25

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = '007'
down_revision = '006'
branch_labels = None
depends_on = None


def upgrade():
    # Create prediction_alerts table to store alert history
    op.create_table(
        'prediction_alerts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('end_customer_id', UUID(as_uuid=True), sa.ForeignKey('end_customers.id', ondelete='CASCADE'), nullable=False),

        # Alert details
        sa.Column('alert_type', sa.String(50), nullable=False),  # warning, critical, exceeded
        sa.Column('current_spend', sa.Numeric(12, 6), nullable=False),
        sa.Column('budget_limit', sa.Numeric(12, 6), nullable=False),
        sa.Column('utilization_percent', sa.Numeric(5, 2), nullable=False),
        sa.Column('forecasted_exceed_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('message', sa.Text, nullable=False),
        sa.Column('recommendations', JSONB, default=list),

        # Prediction metadata
        sa.Column('confidence_score', sa.Numeric(3, 2), nullable=True),
        sa.Column('prediction_factors', JSONB, default=list),

        # Status tracking
        sa.Column('status', sa.String(50), default='active'),  # active, acknowledged, resolved
        sa.Column('acknowledged_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('acknowledged_by', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('resolution_notes', sa.Text, nullable=True),

        # Notification tracking
        sa.Column('notification_sent', sa.Boolean, default=False),
        sa.Column('notification_sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notification_channels', JSONB, default=list),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Indexes for efficient querying
    op.create_index('ix_prediction_alerts_tenant_id', 'prediction_alerts', ['tenant_id'])
    op.create_index('ix_prediction_alerts_customer_id', 'prediction_alerts', ['end_customer_id'])
    op.create_index('ix_prediction_alerts_status', 'prediction_alerts', ['status'])
    op.create_index('ix_prediction_alerts_alert_type', 'prediction_alerts', ['alert_type'])
    op.create_index('ix_prediction_alerts_created_at', 'prediction_alerts', ['created_at'])

    # Add prediction settings to end_customers table
    op.add_column('end_customers', sa.Column('prediction_enabled', sa.Boolean(), server_default='true'))
    op.add_column('end_customers', sa.Column('alert_threshold_percent', sa.Numeric(5, 2), server_default='80'))

    # Add tenant-level prediction settings
    op.add_column('tenants', sa.Column('prediction_alerts_enabled', sa.Boolean(), server_default='true'))
    op.add_column('tenants', sa.Column('default_alert_threshold', sa.Numeric(5, 2), server_default='80'))
    op.add_column('tenants', sa.Column('alert_notification_email', sa.String(255), nullable=True))


def downgrade():
    # Remove tenant columns
    op.drop_column('tenants', 'alert_notification_email')
    op.drop_column('tenants', 'default_alert_threshold')
    op.drop_column('tenants', 'prediction_alerts_enabled')

    # Remove customer columns
    op.drop_column('end_customers', 'alert_threshold_percent')
    op.drop_column('end_customers', 'prediction_enabled')

    # Drop indexes
    op.drop_index('ix_prediction_alerts_created_at')
    op.drop_index('ix_prediction_alerts_alert_type')
    op.drop_index('ix_prediction_alerts_status')
    op.drop_index('ix_prediction_alerts_customer_id')
    op.drop_index('ix_prediction_alerts_tenant_id')

    # Drop table
    op.drop_table('prediction_alerts')
