from sqlalchemy import Column, String, Boolean, ForeignKey, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base


class Tenant(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "tenants"

    company_name = Column(String(255), nullable=False)
    slug = Column(String(100), unique=True, nullable=False, index=True)

    # Stripe billing fields
    stripe_customer_id = Column(String(100), unique=True, nullable=True, index=True)
    stripe_subscription_id = Column(String(100), nullable=True)
    current_plan_id = Column(UUID(as_uuid=True), ForeignKey("pricing_plans.id", ondelete="SET NULL"), nullable=True)
    subscription_status = Column(String(50), default="trialing")
    subscription_plan = Column(String(50), default="starter")  # Legacy field
    subscription_period_end = Column(DateTime(timezone=True), nullable=True)

    # Smart Routing settings
    smart_routing_enabled = Column(Boolean, default=False)
    routing_strategy = Column(String(50), default="cost_optimized")

    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    end_customers = relationship("EndCustomer", back_populates="tenant", cascade="all, delete-orphan")
    api_keys = relationship("ApiKey", back_populates="tenant", cascade="all, delete-orphan")
    current_plan = relationship("PricingPlan", back_populates="tenants")
    billing_periods = relationship("BillingPeriod", back_populates="tenant", cascade="all, delete-orphan")
    routing_decisions = relationship("RoutingDecision", back_populates="tenant", cascade="all, delete-orphan")
