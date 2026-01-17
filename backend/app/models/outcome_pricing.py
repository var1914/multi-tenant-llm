from sqlalchemy import Column, String, Numeric, Integer, Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin, TimestampMixin
from app.database import Base


class OutcomePricing(Base, UUIDMixin, TimestampMixin):
    """
    Configures outcome-based pricing for different workflow types.
    Allows billing based on successful outcomes rather than token usage.
    """
    __tablename__ = "outcome_pricing"
    __table_args__ = (
        UniqueConstraint("tenant_id", "workflow_type", name="uq_outcome_pricing_tenant_workflow_type"),
    )

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    workflow_type = Column(String(100), nullable=False)

    # Billing model configuration
    billing_model = Column(String(50), nullable=False)  # per_outcome, tiered_outcome
    price_per_success = Column(Numeric(12, 6), nullable=True)
    free_attempts = Column(Integer, default=0)

    # Tiered pricing configuration (for tiered_outcome model)
    # Format: [{"min": 0, "max": 100, "price": 0.10}, {"min": 101, "max": 500, "price": 0.08}, ...]
    tiers = Column(JSONB, default=list)

    is_active = Column(Boolean, default=True)

    # Relationships
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<OutcomePricing {self.workflow_type}: {self.billing_model}>"

    def calculate_price(self, successful_outcomes: int, total_outcomes: int) -> float:
        """
        Calculate the price based on successful outcomes.
        """
        # Apply free attempts
        billable_outcomes = max(0, successful_outcomes - self.free_attempts)

        if billable_outcomes == 0:
            return 0.0

        if self.billing_model == 'per_outcome':
            return float(self.price_per_success or 0) * billable_outcomes

        elif self.billing_model == 'tiered_outcome':
            total_price = 0.0
            remaining = billable_outcomes

            for tier in sorted(self.tiers or [], key=lambda t: t.get('min', 0)):
                tier_min = tier.get('min', 0)
                tier_max = tier.get('max', float('inf'))
                tier_price = tier.get('price', 0)

                if remaining <= 0:
                    break

                tier_count = min(remaining, tier_max - tier_min + 1)
                total_price += tier_count * tier_price
                remaining -= tier_count

            return total_price

        return 0.0
