from sqlalchemy import Column, String, Boolean, Numeric, BigInteger, Integer, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base
from datetime import datetime


class AgentWorkflow(Base, UUIDMixin, TimestampMixin):
    """
    Represents a multi-step agentic AI workflow.
    Groups multiple LLM calls and agent steps into a single trackable unit.
    """
    __tablename__ = "agent_workflows"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    end_customer_id = Column(UUID(as_uuid=True), ForeignKey("end_customers.id", ondelete="CASCADE"), nullable=True, index=True)

    # Workflow identification
    workflow_id = Column(String(100), nullable=False)  # User-provided or auto-generated
    workflow_name = Column(String(255), nullable=True)
    workflow_type = Column(String(50), default='sequential')  # sequential, parallel, hierarchical

    # Status tracking
    status = Column(String(50), nullable=False, default='running')  # running, completed, failed, paused, paused_over_budget
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Aggregated metrics
    total_steps = Column(Integer, default=0)
    total_llm_calls = Column(Integer, default=0)
    total_tool_calls = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(12, 6), default=0)

    # Budget tracking (for cost guards)
    budget_exceeded = Column(Boolean, default=False)
    budget_alert_sent = Column(Boolean, default=False)

    # Flexible metadata (use 'workflow_metadata' in Python, 'metadata' in DB)
    workflow_metadata = Column("metadata", JSONB, default=dict)

    # Relationships
    tenant = relationship("Tenant", back_populates="agent_workflows")
    end_customer = relationship("EndCustomer", back_populates="agent_workflows")
    steps = relationship("WorkflowStep", back_populates="workflow", cascade="all, delete-orphan", order_by="WorkflowStep.step_number")

    def __repr__(self):
        return f"<AgentWorkflow {self.workflow_id} ({self.status})>"
