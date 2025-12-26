from sqlalchemy import Column, String, BigInteger, Numeric, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin
from app.database import Base
from datetime import datetime


class UsageEvent(Base, UUIDMixin):
    __tablename__ = "usage_events"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    end_customer_id = Column(UUID(as_uuid=True), ForeignKey("end_customers.id", ondelete="CASCADE"), nullable=False, index=True)
    event_timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    event_type = Column(String(50), nullable=False)
    model = Column(String(100), nullable=True)
    provider = Column(String(50), nullable=True)
    quantity = Column(BigInteger, nullable=False)
    cost_usd = Column(Numeric(10, 6), nullable=True)
    event_metadata = Column("metadata", JSONB, default={})
    idempotency_key = Column(String(255), unique=True, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    end_customer = relationship("EndCustomer", back_populates="usage_events")
