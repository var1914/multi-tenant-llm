from sqlalchemy import Column, String, BigInteger, Numeric, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base


class BillingPeriod(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "billing_periods"

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)

    # Period dates
    period_start = Column(DateTime(timezone=True), nullable=False)
    period_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(20), default="active")  # active, closed, invoiced

    # Usage summary
    total_tokens_used = Column(BigInteger(), default=0)
    included_tokens = Column(BigInteger(), nullable=False)  # From their plan
    overage_tokens = Column(BigInteger(), default=0)

    # Costs
    base_cost_usd = Column(Numeric(12, 2), nullable=False)  # Plan price
    overage_cost_usd = Column(Numeric(12, 2), default=0)
    total_cost_usd = Column(Numeric(12, 2), nullable=False)

    # Stripe billing
    stripe_invoice_id = Column(String(100), nullable=True)
    stripe_payment_intent_id = Column(String(100), nullable=True)
    payment_status = Column(String(50), nullable=True)  # pending, paid, failed
    paid_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    tenant = relationship("Tenant", back_populates="billing_periods")
