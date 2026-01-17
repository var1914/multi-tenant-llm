"""Add agent workflows tables for agentic AI billing

Revision ID: 008
Revises: 007
Create Date: 2024-12-29

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision = '008'
down_revision = '007'
branch_labels = None
depends_on = None


def upgrade():
    # Create agent_workflows table - groups multiple LLM calls into a single workflow
    op.create_table(
        'agent_workflows',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('end_customer_id', UUID(as_uuid=True), sa.ForeignKey('end_customers.id', ondelete='CASCADE'), nullable=True),

        # Workflow identification
        sa.Column('workflow_id', sa.String(100), nullable=False),  # User-provided or auto-generated
        sa.Column('workflow_name', sa.String(255), nullable=True),
        sa.Column('workflow_type', sa.String(50), server_default='sequential'),  # sequential, parallel, hierarchical

        # Status tracking
        sa.Column('status', sa.String(50), nullable=False, server_default='running'),  # running, completed, failed, paused, paused_over_budget
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

        # Aggregated metrics
        sa.Column('total_steps', sa.Integer(), server_default='0'),
        sa.Column('total_llm_calls', sa.Integer(), server_default='0'),
        sa.Column('total_tool_calls', sa.Integer(), server_default='0'),
        sa.Column('total_tokens', sa.BigInteger(), server_default='0'),
        sa.Column('total_cost_usd', sa.Numeric(12, 6), server_default='0'),

        # Budget tracking (for cost guards)
        sa.Column('budget_exceeded', sa.Boolean(), server_default='false'),
        sa.Column('budget_alert_sent', sa.Boolean(), server_default='false'),

        # Flexible metadata
        sa.Column('metadata', JSONB, server_default='{}'),

        # Timestamps
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )

    # Indexes for agent_workflows
    op.create_index('ix_agent_workflows_tenant_id', 'agent_workflows', ['tenant_id'])
    op.create_index('ix_agent_workflows_customer_id', 'agent_workflows', ['end_customer_id'])
    op.create_index('ix_agent_workflows_status', 'agent_workflows', ['status', 'started_at'])
    op.create_unique_constraint('uq_agent_workflows_tenant_workflow_id', 'agent_workflows', ['tenant_id', 'workflow_id'])

    # Create workflow_steps table - individual agent steps within a workflow
    op.create_table(
        'workflow_steps',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('workflow_id', UUID(as_uuid=True), sa.ForeignKey('agent_workflows.id', ondelete='CASCADE'), nullable=False),

        # Step identification
        sa.Column('step_number', sa.Integer(), nullable=False),
        sa.Column('agent_name', sa.String(100), nullable=False),
        sa.Column('agent_type', sa.String(50), server_default='execution'),  # planning, execution, verification

        # Timing
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),

        # Metrics
        sa.Column('llm_calls', sa.Integer(), server_default='0'),
        sa.Column('tool_calls', sa.Integer(), server_default='0'),
        sa.Column('tokens_used', sa.BigInteger(), server_default='0'),
        sa.Column('cost_usd', sa.Numeric(12, 6), server_default='0'),

        # Status and output
        sa.Column('status', sa.String(50), nullable=False, server_default='completed'),  # running, completed, failed
        sa.Column('output_summary', sa.Text(), nullable=True),  # First 500 chars of output

        # Flexible metadata
        sa.Column('metadata', JSONB, server_default='{}'),

        # Timestamp
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    # Indexes for workflow_steps
    op.create_index('ix_workflow_steps_tenant_id', 'workflow_steps', ['tenant_id'])
    op.create_index('ix_workflow_steps_workflow_id', 'workflow_steps', ['workflow_id', 'step_number'])
    op.create_index('ix_workflow_steps_agent_name', 'workflow_steps', ['tenant_id', 'agent_name'])


def downgrade():
    # Drop workflow_steps indexes and table
    op.drop_index('ix_workflow_steps_agent_name')
    op.drop_index('ix_workflow_steps_workflow_id')
    op.drop_index('ix_workflow_steps_tenant_id')
    op.drop_table('workflow_steps')

    # Drop agent_workflows indexes and table
    op.drop_constraint('uq_agent_workflows_tenant_workflow_id', 'agent_workflows', type_='unique')
    op.drop_index('ix_agent_workflows_status')
    op.drop_index('ix_agent_workflows_customer_id')
    op.drop_index('ix_agent_workflows_tenant_id')
    op.drop_table('agent_workflows')
