from sqlalchemy import Column, String, Boolean, Numeric, Text, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin
from app.database import Base
from datetime import datetime


class PredictionAlert(Base, UUIDMixin):
    __tablename__ = "prediction_alerts"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    end_customer_id = Column(UUID(as_uuid=True), ForeignKey("end_customers.id", ondelete="CASCADE"), nullable=False)

    # Alert details
    alert_type = Column(String(50), nullable=False)  # warning, critical, exceeded
    current_spend = Column(Numeric(12, 6), nullable=False)
    budget_limit = Column(Numeric(12, 6), nullable=False)
    utilization_percent = Column(Numeric(5, 2), nullable=False)
    forecasted_exceed_date = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=False)
    recommendations = Column(JSONB, default=list)

    # Prediction metadata
    confidence_score = Column(Numeric(3, 2), nullable=True)
    prediction_factors = Column(JSONB, default=list)

    # Status tracking
    status = Column(String(50), default='active')  # active, acknowledged, resolved
    acknowledged_at = Column(DateTime(timezone=True), nullable=True)
    acknowledged_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)
    resolution_notes = Column(Text, nullable=True)

    # Notification tracking
    notification_sent = Column(Boolean, default=False)
    notification_sent_at = Column(DateTime(timezone=True), nullable=True)
    notification_channels = Column(JSONB, default=list)

    # Timestamps
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant", back_populates="prediction_alerts")
    end_customer = relationship("EndCustomer", back_populates="prediction_alerts")
    acknowledged_by_user = relationship("User", foreign_keys=[acknowledged_by])
