from sqlalchemy import Column, String, Numeric, Integer, BigInteger, Date, ForeignKey, UniqueConstraint, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.models.base import UUIDMixin
from app.database import Base
from datetime import datetime


class AgentEfficiency(Base, UUIDMixin):
    """
    Stores precomputed efficiency metrics for agents.
    Updated periodically to provide quick access to agent performance data.
    """
    __tablename__ = "agent_efficiency"
    __table_args__ = (
        UniqueConstraint("tenant_id", "agent_name", "period_start", name="uq_agent_efficiency_tenant_agent_period"),
    )

    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_name = Column(String(100), nullable=False)

    # Time period
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # Metrics
    total_invocations = Column(Integer, default=0)
    successful_invocations = Column(Integer, default=0)
    total_tokens = Column(BigInteger, default=0)
    total_cost_usd = Column(Numeric(12, 6), default=0)

    # Computed metrics
    avg_cost_per_call = Column(Numeric(12, 6), nullable=True)
    success_rate = Column(Numeric(5, 2), nullable=True)
    efficiency_score = Column(Integer, nullable=True)  # 0-100

    # Recommendations for optimization
    # Format: [{"type": "reduce_tokens", "message": "Consider using a smaller model", "impact": "high"}, ...]
    recommendations = Column(JSONB, default=list)

    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)

    # Relationships
    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<AgentEfficiency {self.agent_name}: score={self.efficiency_score}>"

    @classmethod
    def calculate_efficiency_score(
        cls,
        success_rate: float,
        cost_efficiency: float,
        speed_efficiency: float = 1.0
    ) -> int:
        """
        Calculate efficiency score (0-100) based on:
        - success_rate: 40% weight
        - cost_efficiency: 40% weight
        - speed_efficiency: 20% weight

        Args:
            success_rate: 0-1 ratio of successful invocations
            cost_efficiency: 0-1 ratio (1 = lowest cost in category)
            speed_efficiency: 0-1 ratio (1 = fastest in category)
        """
        score = (success_rate * 40) + (cost_efficiency * 40) + (speed_efficiency * 20)
        return int(min(100, max(0, score)))

    def generate_recommendations(self) -> list:
        """
        Generate optimization recommendations based on metrics.
        """
        recommendations = []

        # Low success rate
        if self.success_rate and float(self.success_rate) < 80:
            recommendations.append({
                "type": "improve_success_rate",
                "message": f"Success rate is {self.success_rate}%. Consider improving prompts or adding error handling.",
                "impact": "high"
            })

        # High cost per call
        if self.avg_cost_per_call and float(self.avg_cost_per_call) > 0.01:
            recommendations.append({
                "type": "reduce_cost",
                "message": f"Average cost per call is ${self.avg_cost_per_call}. Consider using a smaller model or optimizing prompts.",
                "impact": "medium"
            })

        # High token usage
        if self.total_invocations and self.total_tokens:
            avg_tokens = self.total_tokens / self.total_invocations
            if avg_tokens > 5000:
                recommendations.append({
                    "type": "reduce_tokens",
                    "message": f"Average tokens per call is {avg_tokens:.0f}. Consider shorter prompts or summarization.",
                    "impact": "medium"
                })

        # Low efficiency score
        if self.efficiency_score and self.efficiency_score < 50:
            recommendations.append({
                "type": "overall_optimization",
                "message": "Overall efficiency is below average. Review agent configuration and usage patterns.",
                "impact": "high"
            })

        return recommendations
