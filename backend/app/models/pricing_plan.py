from sqlalchemy import Column, String, Boolean, Integer, Numeric, BigInteger, JSON
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base


class PricingPlan(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "pricing_plans"

    name = Column(String(100), nullable=False)
    slug = Column(String(50), nullable=False, unique=True, index=True)
    description = Column(String(500), nullable=True)

    # Pricing
    price_monthly_usd = Column(Numeric(10, 2), nullable=False)
    price_yearly_usd = Column(Numeric(10, 2), nullable=True)

    # Usage limits
    included_tokens = Column(BigInteger(), nullable=False)
    overage_price_per_1k_tokens = Column(Numeric(10, 6), nullable=False)
    max_customers = Column(Integer(), nullable=True)  # NULL = unlimited
    max_api_keys = Column(Integer(), nullable=True)  # NULL = unlimited

    # Features enabled for this plan (JSON array of feature flags)
    features = Column(JSON(), nullable=True)

    # Stripe integration
    stripe_price_id_monthly = Column(String(100), nullable=True)
    stripe_price_id_yearly = Column(String(100), nullable=True)

    # Status
    is_active = Column(Boolean(), default=True, index=True)
    sort_order = Column(Integer(), default=0)

    # Relationships
    tenants = relationship("Tenant", back_populates="current_plan")
