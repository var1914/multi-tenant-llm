from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from typing import List, Optional
from uuid import UUID
from decimal import Decimal
from datetime import datetime, date, timedelta
from dataclasses import dataclass

from app.models.agent_efficiency import AgentEfficiency
from app.models.workflow_step import WorkflowStep
from app.models.agent_workflow import AgentWorkflow


@dataclass
class Recommendation:
    """Optimization recommendation for an agent."""
    agent_name: str
    type: str
    message: str
    impact: str  # high, medium, low
    potential_savings: Optional[float] = None


@dataclass
class AgentMetrics:
    """Current metrics for an agent."""
    agent_name: str
    total_invocations: int
    successful_invocations: int
    total_tokens: int
    total_cost: float
    avg_cost_per_call: float
    success_rate: float
    efficiency_score: int
    recommendations: List[dict]


class EfficiencyService:
    """
    Service for calculating and analyzing agent efficiency.
    Provides metrics, scores, and optimization recommendations.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def calculate_agent_efficiency(
        self,
        tenant_id: UUID,
        days: int = 30,
    ) -> List[AgentMetrics]:
        """
        Calculate efficiency metrics for all agents in the specified period.
        """
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        # Get agent metrics from workflow steps
        result = await self.db.execute(
            select(
                WorkflowStep.agent_name,
                func.count(WorkflowStep.id).label('total_invocations'),
                func.count(WorkflowStep.id).filter(WorkflowStep.status == 'completed').label('successful'),
                func.sum(WorkflowStep.tokens_used).label('total_tokens'),
                func.sum(WorkflowStep.cost_usd).label('total_cost'),
            )
            .join(AgentWorkflow, WorkflowStep.workflow_id == AgentWorkflow.id)
            .where(
                AgentWorkflow.tenant_id == tenant_id,
                WorkflowStep.created_at >= start_date,
            )
            .group_by(WorkflowStep.agent_name)
        )

        agents = []
        all_costs = []

        # First pass: collect all metrics
        rows = result.all()
        for row in rows:
            cost = float(row.total_cost or 0)
            all_costs.append(cost)

        max_cost = max(all_costs) if all_costs else 1

        # Second pass: calculate scores and recommendations
        for row in rows:
            total = row.total_invocations or 0
            successful = row.successful or 0
            tokens = int(row.total_tokens or 0)
            cost = float(row.total_cost or 0)

            if total == 0:
                continue

            success_rate = (successful / total) * 100
            avg_cost = cost / total
            cost_efficiency = 1 - (cost / max_cost) if max_cost > 0 else 1

            # Calculate efficiency score
            efficiency_score = AgentEfficiency.calculate_efficiency_score(
                success_rate=success_rate / 100,
                cost_efficiency=cost_efficiency,
            )

            # Generate recommendations
            recommendations = self._generate_recommendations(
                agent_name=row.agent_name,
                success_rate=success_rate,
                avg_cost=avg_cost,
                avg_tokens=tokens / total if total > 0 else 0,
                efficiency_score=efficiency_score,
            )

            agents.append(AgentMetrics(
                agent_name=row.agent_name,
                total_invocations=total,
                successful_invocations=successful,
                total_tokens=tokens,
                total_cost=cost,
                avg_cost_per_call=avg_cost,
                success_rate=success_rate,
                efficiency_score=efficiency_score,
                recommendations=recommendations,
            ))

        # Sort by efficiency score (lowest first, to highlight problems)
        agents.sort(key=lambda a: a.efficiency_score)

        return agents

    def _generate_recommendations(
        self,
        agent_name: str,
        success_rate: float,
        avg_cost: float,
        avg_tokens: float,
        efficiency_score: int,
    ) -> List[dict]:
        """
        Generate optimization recommendations based on metrics.
        """
        recommendations = []

        # Low success rate
        if success_rate < 80:
            recommendations.append({
                "type": "improve_success_rate",
                "message": f"Success rate is {success_rate:.1f}%. Consider improving prompts or adding error handling.",
                "impact": "high"
            })

        # High cost per call
        if avg_cost > 0.01:
            recommendations.append({
                "type": "reduce_cost",
                "message": f"Average cost per call is ${avg_cost:.4f}. Consider using a smaller model.",
                "impact": "medium"
            })

        # High token usage
        if avg_tokens > 5000:
            recommendations.append({
                "type": "reduce_tokens",
                "message": f"Average tokens per call is {avg_tokens:.0f}. Consider shorter prompts.",
                "impact": "medium"
            })

        # Low efficiency score
        if efficiency_score < 50:
            recommendations.append({
                "type": "overall_optimization",
                "message": "Overall efficiency is below average. Review agent configuration.",
                "impact": "high"
            })

        return recommendations

    async def get_optimization_recommendations(
        self,
        tenant_id: UUID,
        days: int = 30,
    ) -> List[Recommendation]:
        """
        Get all optimization recommendations across agents.
        """
        agents = await self.calculate_agent_efficiency(tenant_id, days)

        all_recommendations = []
        for agent in agents:
            for rec in agent.recommendations:
                # Estimate potential savings
                potential_savings = None
                if rec['type'] == 'reduce_cost':
                    # Estimate 30% savings if they switch to a smaller model
                    potential_savings = agent.total_cost * 0.3
                elif rec['type'] == 'improve_success_rate':
                    # Estimate cost of failed invocations
                    failed = agent.total_invocations - agent.successful_invocations
                    if failed > 0:
                        potential_savings = agent.avg_cost_per_call * failed

                all_recommendations.append(Recommendation(
                    agent_name=agent.agent_name,
                    type=rec['type'],
                    message=rec['message'],
                    impact=rec['impact'],
                    potential_savings=potential_savings,
                ))

        # Sort by impact and potential savings
        impact_order = {'high': 0, 'medium': 1, 'low': 2}
        all_recommendations.sort(
            key=lambda r: (impact_order.get(r.impact, 3), -(r.potential_savings or 0))
        )

        return all_recommendations

    async def refresh_efficiency_scores(
        self,
        tenant_id: UUID,
        period_start: date,
        period_end: date,
    ) -> List[AgentEfficiency]:
        """
        Refresh precomputed efficiency scores for the specified period.
        Stores results in the agent_efficiency table for quick access.
        """
        # Calculate current metrics
        days = (period_end - period_start).days
        agents = await self.calculate_agent_efficiency(tenant_id, days)

        stored_records = []

        for agent in agents:
            # Check if record exists
            result = await self.db.execute(
                select(AgentEfficiency).where(
                    AgentEfficiency.tenant_id == tenant_id,
                    AgentEfficiency.agent_name == agent.agent_name,
                    AgentEfficiency.period_start == period_start,
                )
            )
            existing = result.scalar_one_or_none()

            if existing:
                # Update existing
                existing.total_invocations = agent.total_invocations
                existing.successful_invocations = agent.successful_invocations
                existing.total_tokens = agent.total_tokens
                existing.total_cost_usd = Decimal(str(agent.total_cost))
                existing.avg_cost_per_call = Decimal(str(agent.avg_cost_per_call))
                existing.success_rate = Decimal(str(agent.success_rate))
                existing.efficiency_score = agent.efficiency_score
                existing.recommendations = agent.recommendations
                stored_records.append(existing)
            else:
                # Create new
                record = AgentEfficiency(
                    tenant_id=tenant_id,
                    agent_name=agent.agent_name,
                    period_start=period_start,
                    period_end=period_end,
                    total_invocations=agent.total_invocations,
                    successful_invocations=agent.successful_invocations,
                    total_tokens=agent.total_tokens,
                    total_cost_usd=Decimal(str(agent.total_cost)),
                    avg_cost_per_call=Decimal(str(agent.avg_cost_per_call)),
                    success_rate=Decimal(str(agent.success_rate)),
                    efficiency_score=agent.efficiency_score,
                    recommendations=agent.recommendations,
                )
                self.db.add(record)
                stored_records.append(record)

        await self.db.commit()

        return stored_records

    async def get_agent_comparison(
        self,
        tenant_id: UUID,
        days: int = 30,
    ) -> dict:
        """
        Get a comparison summary of all agents.
        Useful for identifying best and worst performers.
        """
        agents = await self.calculate_agent_efficiency(tenant_id, days)

        if not agents:
            return {
                "total_agents": 0,
                "best_performer": None,
                "worst_performer": None,
                "average_efficiency": 0,
                "total_cost": 0,
                "agents_needing_attention": [],
            }

        sorted_by_score = sorted(agents, key=lambda a: a.efficiency_score, reverse=True)

        return {
            "total_agents": len(agents),
            "best_performer": {
                "name": sorted_by_score[0].agent_name,
                "score": sorted_by_score[0].efficiency_score,
            } if sorted_by_score else None,
            "worst_performer": {
                "name": sorted_by_score[-1].agent_name,
                "score": sorted_by_score[-1].efficiency_score,
            } if sorted_by_score else None,
            "average_efficiency": sum(a.efficiency_score for a in agents) / len(agents),
            "total_cost": sum(a.total_cost for a in agents),
            "agents_needing_attention": [
                a.agent_name for a in agents if a.efficiency_score < 50
            ],
        }
