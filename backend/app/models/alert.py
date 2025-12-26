from sqlalchemy import Column, String, ForeignKey, Numeric, Enum, Float
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base
import enum


class AlertType(str, enum.Enum):
    BUDGET_WARNING = "budget_warning"
    BUDGET_EXCEEDED = "budget_exceeded"


class AlertStatus(str, enum.Enum):
    PENDING = "pending"
    SENT = "sent"
    FAILED = "failed"


class Alert(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "alerts"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(String(255), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)
    message = Column(String(1000), nullable=False)
    threshold_percentage = Column(Float, nullable=False)
    current_spend_usd = Column(Numeric(12, 6), nullable=False)
    budget_limit_usd = Column(Numeric(12, 6), nullable=False)
    status = Column(String(20), default="pending")

    # Relationships
    tenant = relationship("Tenant")
