from sqlalchemy import Column, String, Boolean, Numeric, BigInteger, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin
from app.database import Base
from datetime import datetime


class RoutingDecision(Base, UUIDMixin):
    __tablename__ = "routing_decisions"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    end_customer_id = Column(UUID(as_uuid=True), ForeignKey("end_customers.id", ondelete="SET NULL"), nullable=True)
    event_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Model routing info
    original_model = Column(String(100), nullable=False)
    routed_model = Column(String(100), nullable=False)
    routing_applied = Column(Boolean, default=False)
    routing_reason = Column(Text, nullable=True)

    # Complexity analysis
    complexity_score = Column(Numeric(5, 2), nullable=True)
    complexity_reasons = Column(JSONB, default=list)

    # Cost tracking
    estimated_savings_usd = Column(Numeric(10, 6), default=0)
    actual_tokens = Column(BigInteger, nullable=True)
    actual_cost_usd = Column(Numeric(10, 6), nullable=True)

    # RouteLLM ML-based routing tracking
    routellm_win_rate = Column(Numeric(5, 4), nullable=True)  # 0.0000 - 1.0000
    routellm_used = Column(Boolean, default=False)
    routellm_confident = Column(Boolean, default=False)

    # Request tracking
    request_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="routing_decisions")
    end_customer = relationship("EndCustomer", back_populates="routing_decisions")
