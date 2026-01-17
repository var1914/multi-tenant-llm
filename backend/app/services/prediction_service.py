"""
Predictive Budget Alerts Service.

Uses historical usage data to forecast future spending and predict
when customers will exceed their budget limits.
"""

import numpy as np
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any, Tuple
from decimal import Decimal
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from dataclasses import dataclass

from app.models.usage_event import UsageEvent
from app.models.end_customer import EndCustomer
from app.models.tenant import Tenant


@dataclass
class UsageForecast:
    """Forecast result for a customer."""
    customer_id: str
    customer_name: Optional[str]
    current_spend: float
    budget_limit: Optional[float]
    forecasted_spend_eom: float  # End of month
    forecasted_spend_7d: float   # Next 7 days
    forecasted_spend_30d: float  # Next 30 days
    daily_average: float
    daily_trend: float  # Positive = increasing, negative = decreasing
    days_until_budget_exceeded: Optional[int]
    budget_utilization_percent: float
    confidence_score: float  # 0-1, how confident the prediction is
    risk_level: str  # "low", "medium", "high", "critical"
    prediction_factors: List[str]


@dataclass
class BudgetAlert:
    """Alert for budget threshold breach."""
    customer_id: UUID
    customer_external_id: str
    customer_name: Optional[str]
    alert_type: str  # "warning", "critical", "exceeded"
    current_spend: float
    budget_limit: float
    forecasted_exceed_date: Optional[datetime]
    utilization_percent: float
    message: str
    recommendations: List[str]


class PredictionService:
    """Service for predicting usage and generating budget alerts."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_customer_daily_usage(
        self,
        tenant_id: UUID,
        customer_id: UUID,
        days: int = 30
    ) -> List[Tuple[datetime, float]]:
        """Get daily usage data for a customer."""
        start_date = datetime.utcnow() - timedelta(days=days)

        result = await self.db.execute(
            select(
                func.date(UsageEvent.event_timestamp).label("date"),
                func.sum(UsageEvent.cost_usd).label("daily_cost")
            )
            .where(UsageEvent.tenant_id == tenant_id)
            .where(UsageEvent.end_customer_id == customer_id)
            .where(UsageEvent.event_timestamp >= start_date)
            .group_by(func.date(UsageEvent.event_timestamp))
            .order_by(func.date(UsageEvent.event_timestamp))
        )

        return [(row[0], float(row[1] or 0)) for row in result.fetchall()]

    async def get_customer_current_month_spend(
        self,
        tenant_id: UUID,
        customer_id: UUID
    ) -> float:
        """Get current month's total spend for a customer."""
        now = datetime.utcnow()
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        result = await self.db.execute(
            select(func.sum(UsageEvent.cost_usd))
            .where(UsageEvent.tenant_id == tenant_id)
            .where(UsageEvent.end_customer_id == customer_id)
            .where(UsageEvent.event_timestamp >= month_start)
        )

        return float(result.scalar() or 0)

    def calculate_daily_average(self, daily_data: List[Tuple[datetime, float]]) -> float:
        """Calculate average daily spend."""
        if not daily_data:
            return 0.0
        costs = [d[1] for d in daily_data]
        return sum(costs) / len(costs)

    def calculate_trend(self, daily_data: List[Tuple[datetime, float]]) -> float:
        """
        Calculate trend using linear regression.
        Returns slope (positive = increasing spend, negative = decreasing).
        """
        if len(daily_data) < 3:
            return 0.0

        costs = [d[1] for d in daily_data]
        n = len(costs)
        x = np.arange(n)
        y = np.array(costs)

        # Simple linear regression
        x_mean = np.mean(x)
        y_mean = np.mean(y)

        numerator = np.sum((x - x_mean) * (y - y_mean))
        denominator = np.sum((x - x_mean) ** 2)

        if denominator == 0:
            return 0.0

        slope = numerator / denominator
        return float(slope)

    def calculate_weighted_average(
        self,
        daily_data: List[Tuple[datetime, float]],
        recent_weight: float = 2.0
    ) -> float:
        """
        Calculate weighted average giving more weight to recent data.
        """
        if not daily_data:
            return 0.0

        n = len(daily_data)
        if n == 1:
            return daily_data[0][1]

        # Exponential weights favoring recent data
        weights = np.array([recent_weight ** (i / n) for i in range(n)])
        weights = weights / weights.sum()

        costs = np.array([d[1] for d in daily_data])
        return float(np.sum(costs * weights))

    def forecast_spend(
        self,
        daily_data: List[Tuple[datetime, float]],
        days_ahead: int
    ) -> Tuple[float, float]:
        """
        Forecast spend for the next N days.
        Returns (forecasted_amount, confidence_score).
        """
        if not daily_data:
            return 0.0, 0.0

        # Calculate components
        avg = self.calculate_daily_average(daily_data)
        weighted_avg = self.calculate_weighted_average(daily_data)
        trend = self.calculate_trend(daily_data)

        # Blend average with weighted average and trend
        # More data = more confidence in trend
        data_points = len(daily_data)
        trend_confidence = min(1.0, data_points / 14)  # Full confidence at 14+ days

        base_forecast = (avg * 0.3 + weighted_avg * 0.7)
        trend_adjustment = trend * (days_ahead / 2) * trend_confidence

        forecasted_daily = max(0, base_forecast + trend_adjustment / days_ahead)
        total_forecast = forecasted_daily * days_ahead

        # Calculate confidence based on data quantity and variance
        if data_points >= 14:
            confidence = 0.85
        elif data_points >= 7:
            confidence = 0.7
        elif data_points >= 3:
            confidence = 0.5
        else:
            confidence = 0.3

        # Reduce confidence if high variance
        costs = [d[1] for d in daily_data]
        if len(costs) > 1:
            cv = np.std(costs) / np.mean(costs) if np.mean(costs) > 0 else 0
            variance_penalty = min(0.3, cv * 0.2)
            confidence -= variance_penalty

        return total_forecast, max(0.1, confidence)

    def days_until_budget_exceeded(
        self,
        current_spend: float,
        budget_limit: float,
        daily_forecast: float
    ) -> Optional[int]:
        """Calculate days until budget is exceeded."""
        if budget_limit is None or budget_limit <= 0:
            return None

        remaining_budget = budget_limit - current_spend

        if remaining_budget <= 0:
            return 0  # Already exceeded

        if daily_forecast <= 0:
            return None  # Won't exceed

        days = int(remaining_budget / daily_forecast)
        return days

    def determine_risk_level(
        self,
        utilization: float,
        days_until_exceeded: Optional[int],
        trend: float
    ) -> str:
        """Determine risk level based on multiple factors."""
        if utilization >= 100:
            return "critical"

        if days_until_exceeded is not None:
            if days_until_exceeded <= 3:
                return "critical"
            elif days_until_exceeded <= 7:
                return "high"
            elif days_until_exceeded <= 14:
                return "medium"

        if utilization >= 90:
            return "high" if trend > 0 else "medium"
        elif utilization >= 75:
            return "medium" if trend > 0 else "low"
        elif utilization >= 50:
            return "low"

        return "low"

    def generate_prediction_factors(
        self,
        daily_data: List[Tuple[datetime, float]],
        trend: float,
        utilization: float
    ) -> List[str]:
        """Generate human-readable factors affecting the prediction."""
        factors = []

        data_points = len(daily_data)
        if data_points < 7:
            factors.append(f"Limited data ({data_points} days) - prediction may be less accurate")
        elif data_points >= 14:
            factors.append(f"Good data coverage ({data_points} days)")

        if trend > 0.1:
            factors.append("Usage trend is increasing")
        elif trend < -0.1:
            factors.append("Usage trend is decreasing")
        else:
            factors.append("Usage trend is stable")

        if utilization >= 80:
            factors.append("High budget utilization detected")

        # Check for spikes
        if daily_data:
            costs = [d[1] for d in daily_data]
            avg = np.mean(costs)
            if any(c > avg * 2.5 for c in costs[-7:]):
                factors.append("Recent usage spike detected")

        return factors

    async def forecast_customer(
        self,
        tenant_id: UUID,
        customer: EndCustomer
    ) -> UsageForecast:
        """Generate a complete forecast for a customer."""
        daily_data = await self.get_customer_daily_usage(
            tenant_id, customer.id, days=30
        )
        current_month_spend = await self.get_customer_current_month_spend(
            tenant_id, customer.id
        )

        # Calculate metrics
        daily_avg = self.calculate_daily_average(daily_data)
        trend = self.calculate_trend(daily_data)

        # Forecast for different periods
        forecast_7d, conf_7d = self.forecast_spend(daily_data, 7)
        forecast_30d, conf_30d = self.forecast_spend(daily_data, 30)

        # End of month forecast
        now = datetime.utcnow()
        days_remaining = (now.replace(month=now.month % 12 + 1, day=1) - now).days
        forecast_eom, conf_eom = self.forecast_spend(daily_data, days_remaining)
        forecast_eom += current_month_spend

        # Budget calculations
        budget_limit = float(customer.budget_limit_usd) if customer.budget_limit_usd else None
        utilization = (current_month_spend / budget_limit * 100) if budget_limit else 0

        days_exceeded = None
        if budget_limit:
            days_exceeded = self.days_until_budget_exceeded(
                current_month_spend, budget_limit, daily_avg
            )

        risk_level = self.determine_risk_level(utilization, days_exceeded, trend)
        factors = self.generate_prediction_factors(daily_data, trend, utilization)

        # Average confidence
        confidence = (conf_7d + conf_30d + conf_eom) / 3

        return UsageForecast(
            customer_id=customer.external_id,
            customer_name=customer.name,
            current_spend=current_month_spend,
            budget_limit=budget_limit,
            forecasted_spend_eom=forecast_eom,
            forecasted_spend_7d=forecast_7d,
            forecasted_spend_30d=forecast_30d,
            daily_average=daily_avg,
            daily_trend=trend,
            days_until_budget_exceeded=days_exceeded,
            budget_utilization_percent=utilization,
            confidence_score=confidence,
            risk_level=risk_level,
            prediction_factors=factors
        )

    async def get_all_forecasts(
        self,
        tenant_id: UUID,
        risk_filter: Optional[str] = None
    ) -> List[UsageForecast]:
        """Get forecasts for all customers."""
        result = await self.db.execute(
            select(EndCustomer)
            .where(EndCustomer.tenant_id == tenant_id)
        )
        customers = result.scalars().all()

        forecasts = []
        for customer in customers:
            forecast = await self.forecast_customer(tenant_id, customer)

            if risk_filter:
                if risk_filter == "at_risk" and forecast.risk_level in ["medium", "high", "critical"]:
                    forecasts.append(forecast)
                elif risk_filter == forecast.risk_level:
                    forecasts.append(forecast)
            else:
                forecasts.append(forecast)

        # Sort by risk level and utilization
        risk_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
        forecasts.sort(key=lambda f: (risk_order.get(f.risk_level, 4), -f.budget_utilization_percent))

        return forecasts

    async def generate_budget_alerts(
        self,
        tenant_id: UUID,
        threshold_percent: float = 80
    ) -> List[BudgetAlert]:
        """Generate budget alerts for customers approaching or exceeding limits."""
        forecasts = await self.get_all_forecasts(tenant_id)
        alerts = []

        for forecast in forecasts:
            if not forecast.budget_limit:
                continue

            # Determine alert type
            alert_type = None
            message = ""
            recommendations = []

            if forecast.budget_utilization_percent >= 100:
                alert_type = "exceeded"
                message = f"Budget exceeded! Current spend ${forecast.current_spend:.2f} exceeds limit ${forecast.budget_limit:.2f}"
                recommendations = [
                    "Review recent high-cost requests",
                    "Consider upgrading budget limit",
                    "Implement request throttling"
                ]
            elif forecast.days_until_budget_exceeded is not None and forecast.days_until_budget_exceeded <= 7:
                alert_type = "critical"
                message = f"Budget will be exceeded in ~{forecast.days_until_budget_exceeded} days at current rate"
                recommendations = [
                    "Review usage patterns immediately",
                    "Consider enabling smart routing to reduce costs",
                    "Notify customer about approaching limit"
                ]
            elif forecast.budget_utilization_percent >= threshold_percent:
                alert_type = "warning"
                message = f"Budget {forecast.budget_utilization_percent:.0f}% utilized"
                recommendations = [
                    "Monitor usage closely",
                    "Review forecasted spend",
                    "Consider proactive customer communication"
                ]

            if alert_type:
                # Get customer UUID
                result = await self.db.execute(
                    select(EndCustomer)
                    .where(EndCustomer.tenant_id == tenant_id)
                    .where(EndCustomer.external_id == forecast.customer_id)
                )
                customer = result.scalar_one_or_none()

                if customer:
                    exceed_date = None
                    if forecast.days_until_budget_exceeded is not None:
                        exceed_date = datetime.utcnow() + timedelta(days=forecast.days_until_budget_exceeded)

                    alerts.append(BudgetAlert(
                        customer_id=customer.id,
                        customer_external_id=forecast.customer_id,
                        customer_name=forecast.customer_name,
                        alert_type=alert_type,
                        current_spend=forecast.current_spend,
                        budget_limit=forecast.budget_limit,
                        forecasted_exceed_date=exceed_date,
                        utilization_percent=forecast.budget_utilization_percent,
                        message=message,
                        recommendations=recommendations
                    ))

        return alerts

    async def get_tenant_prediction_summary(
        self,
        tenant_id: UUID
    ) -> Dict[str, Any]:
        """Get summary prediction stats for a tenant."""
        forecasts = await self.get_all_forecasts(tenant_id)

        total_customers = len(forecasts)
        customers_with_budget = sum(1 for f in forecasts if f.budget_limit)

        risk_counts = {"low": 0, "medium": 0, "high": 0, "critical": 0}
        for f in forecasts:
            risk_counts[f.risk_level] += 1

        total_current_spend = sum(f.current_spend for f in forecasts)
        total_forecasted_30d = sum(f.forecasted_spend_30d for f in forecasts)

        at_risk_customers = [f for f in forecasts if f.risk_level in ["medium", "high", "critical"]]

        avg_confidence = np.mean([f.confidence_score for f in forecasts]) if forecasts else 0

        return {
            "total_customers": total_customers,
            "customers_with_budget": customers_with_budget,
            "risk_distribution": risk_counts,
            "at_risk_count": len(at_risk_customers),
            "total_current_spend": total_current_spend,
            "total_forecasted_30d": total_forecasted_30d,
            "average_confidence": avg_confidence,
            "high_risk_customers": [
                {
                    "customer_id": f.customer_id,
                    "customer_name": f.customer_name,
                    "risk_level": f.risk_level,
                    "utilization": f.budget_utilization_percent,
                    "days_until_exceeded": f.days_until_budget_exceeded
                }
                for f in at_risk_customers[:5]  # Top 5
            ]
        }
