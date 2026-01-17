from sqlalchemy import Column, String, Numeric, BigInteger, Integer, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin
from app.database import Base
from datetime import datetime


class WorkflowStep(Base, UUIDMixin):
    """
    Represents a single step within an agentic AI workflow.
    Each step corresponds to one agent's execution within the workflow.
    """
    __tablename__ = "workflow_steps"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("agent_workflows.id", ondelete="CASCADE"), nullable=False)

    # Step identification
    step_number = Column(Integer, nullable=False)
    agent_name = Column(String(100), nullable=False)
    agent_type = Column(String(50), default='execution')  # planning, execution, verification

    # Timing
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Metrics
    llm_calls = Column(Integer, default=0)
    tool_calls = Column(Integer, default=0)
    tokens_used = Column(BigInteger, default=0)
    cost_usd = Column(Numeric(12, 6), default=0)

    # Status and output
    status = Column(String(50), nullable=False, default='completed')  # running, completed, failed
    output_summary = Column(Text, nullable=True)  # First 500 chars of output

    # Flexible metadata (use 'step_metadata' in Python, 'metadata' in DB)
    step_metadata = Column("metadata", JSONB, default=dict)

    # Timestamp
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant")
    workflow = relationship("AgentWorkflow", back_populates="steps")

    def __repr__(self):
        return f"<WorkflowStep {self.step_number}: {self.agent_name} ({self.status})>"
