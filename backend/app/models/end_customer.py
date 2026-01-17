from sqlalchemy import Column, String, ForeignKey, UniqueConstraint, Numeric, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base


class EndCustomer(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "end_customers"
    __table_args__ = (
        UniqueConstraint("tenant_id", "external_id", name="uq_tenant_external_id"),
    )

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    external_id = Column(String(255), nullable=False)
    name = Column(String(255), nullable=True)
    email = Column(String(255), nullable=True)
    customer_metadata = Column("metadata", JSONB, default={})

    # Budget settings
    budget_limit_usd = Column(Numeric(12, 6), nullable=True)  # Monthly budget limit
    budget_alert_threshold = Column(Numeric(5, 2), default=80)  # Alert at 80% by default
    budget_alert_enabled = Column(Boolean, default=True)
    budget_block_on_limit = Column(Boolean, default=False)  # Block requests when limit exceeded

    # Workflow budget settings (for agentic AI cost guards)
    workflow_budget_usd = Column(Numeric(12, 6), nullable=True)  # Per-workflow budget limit
    workflow_budget_action = Column(String(50), default='alert')  # 'alert' or 'pause'

    # Prediction settings
    prediction_enabled = Column(Boolean, default=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="end_customers")
    usage_events = relationship("UsageEvent", back_populates="end_customer", cascade="all, delete-orphan")
    routing_decisions = relationship("RoutingDecision", back_populates="end_customer")
    prediction_alerts = relationship("PredictionAlert", back_populates="end_customer", cascade="all, delete-orphan")
    agent_workflows = relationship("AgentWorkflow", back_populates="end_customer", cascade="all, delete-orphan")
