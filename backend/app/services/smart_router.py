"""
Smart Model Routing Service.

Uses ML-based routing to intelligently select the most cost-effective model
while maintaining quality for complex tasks.

Routing Pipeline:
1. RouteLLM (Primary) - ML-based win-rate prediction (~85% cost savings at 95% quality)
2. Semantic Classification (Fallback) - Embedding-based task classification

No keyword-based heuristics - ML models provide better accuracy for modern users.
"""

import re
import logging
from typing import Optional, Tuple, List, Dict, Any
from decimal import Decimal
from uuid import UUID
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.routing_decision import RoutingDecision
from app.models.tenant import Tenant
from app.services.semantic_router_service import (
    get_semantic_classifier,
    is_semantic_router_available,
)
from app.services.routellm_service import (
    get_routellm_service,
    is_routellm_available,
    DEFAULT_THRESHOLD as ROUTELLM_DEFAULT_THRESHOLD,
)

logger = logging.getLogger(__name__)


# Model tier definitions (complexity threshold -> model)
MODEL_TIERS = {
    "openai": {
        "premium": ["gpt-4o", "gpt-4-turbo"],
        "standard": ["gpt-4o-mini", "gpt-3.5-turbo"],
    },
    "anthropic": {
        "premium": ["claude-3-5-sonnet", "claude-3-opus"],
        "standard": ["claude-3-haiku"],
    },
    "google": {
        "premium": ["gemini-1.5-pro"],
        "standard": ["gemini-1.5-flash"],
    },
}

# Task-specific model recommendations (best model for each task type)
# Format: task_type -> list of (model, reason) tuples in order of preference
TASK_MODEL_RECOMMENDATIONS = {
    "coding": [
        ("claude-3-5-sonnet", "Excellent at code generation and debugging"),
        ("gpt-4o", "Strong coding capabilities"),
        ("gpt-4-turbo", "Good for complex code tasks"),
    ],
    "analysis": [
        ("claude-3-5-sonnet", "Strong analytical reasoning"),
        ("gpt-4o", "Good at data analysis"),
        ("gemini-1.5-pro", "Great for document analysis"),
    ],
    "reasoning": [
        ("claude-3-opus", "Best for complex multi-step reasoning"),
        ("gpt-4o", "Strong logical reasoning"),
        ("claude-3-5-sonnet", "Good reasoning capabilities"),
    ],
    "creative": [
        ("gpt-4o", "Creative and engaging responses"),
        ("claude-3-5-sonnet", "Good creative writing"),
        ("gemini-1.5-pro", "Creative capabilities"),
    ],
    "translation": [
        ("gpt-4o-mini", "Cost-effective for translation"),
        ("gpt-3.5-turbo", "Good translation at low cost"),
        ("claude-3-haiku", "Fast translation"),
    ],
    "summarization": [
        ("gpt-4o-mini", "Efficient summarization"),
        ("claude-3-haiku", "Fast and accurate summaries"),
        ("gemini-1.5-flash", "Quick summarization"),
    ],
    "extraction": [
        ("gpt-4o-mini", "Efficient data extraction"),
        ("claude-3-haiku", "Fast extraction"),
        ("gpt-3.5-turbo", "Cost-effective extraction"),
    ],
    "simple": [
        ("gpt-4o-mini", "Fast and cost-effective"),
        ("gpt-3.5-turbo", "Quick responses"),
        ("claude-3-haiku", "Fast and cheap"),
    ],
}

# Model cost per 1M tokens (input/output) for savings estimation
MODEL_COSTS = {
    # OpenAI
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    # Anthropic
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    # Google
    "gemini-1.5-pro": {"input": 1.25, "output": 5.00},
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30},
}

# Routing strategies (simplified to 2 clear options)
ROUTING_STRATEGIES = {
    "cost_optimized": {
        "description": "Save money - route simple queries to cheaper models",
        "complexity_threshold": 0.5,
    },
    "quality_first": {
        "description": "Best results - only route very simple queries",
        "complexity_threshold": 0.2,
    },
}


class ComplexityAnalyzer:
    """
    Analyzes request complexity using ML-based approaches only.

    Uses semantic task classification (embedding-based) for task detection.
    No keyword-based heuristics - ML models provide better accuracy.
    """

    @classmethod
    def analyze(
        cls,
        messages: List[Dict[str, Any]],
        model: str,
        use_semantic: bool = True,
    ) -> Tuple[float, List[str], Dict[str, Any]]:
        """
        Analyze complexity of a request using ML-based semantic classification.

        Args:
            messages: List of message dicts
            model: The requested model
            use_semantic: Whether to use semantic classification

        Returns:
            Tuple of (complexity_score 0-1, list of reasons, task_info dict)
        """
        reasons = []
        score = 0.5  # Start at neutral (will be adjusted by semantic classifier)
        task_info = {
            "task_type": None,
            "task_confidence": 0.0,
            "semantic_available": is_semantic_router_available(),
            "ml_routing": True,  # Flag indicating ML-only routing
        }

        # Extract all text content
        text_content = ""
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                text_content += " " + content
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_content += " " + item.get("text", "")

        # ML-Based Semantic Task Classification
        if use_semantic and is_semantic_router_available():
            try:
                classifier = get_semantic_classifier()
                semantic_result = classifier.analyze_with_task(messages)

                task_info["task_type"] = semantic_result["task_type"]
                task_info["task_confidence"] = semantic_result["task_confidence"]

                # Apply complexity adjustment based on ML task classification
                complexity_adj = semantic_result["complexity_adjustment"]
                score += complexity_adj
                reasons.append(f"ML Task: {semantic_result['task_type']} ({semantic_result['recommended_tier']})")

            except Exception as e:
                logger.warning(f"Semantic classification failed: {e}")
                task_info["task_type"] = "unknown"
                reasons.append("ML classification unavailable")
        else:
            # No ML available - use conservative routing (don't route to cheaper)
            task_info["task_type"] = "unknown"
            task_info["task_confidence"] = 0.0
            score = 0.7  # Above threshold - keep original model when ML not available
            reasons.append("ML routing unavailable - using original model")

        # Basic structural signals (not keyword matching, just metadata)
        word_count = len(text_content.split())
        if word_count > 500:
            score += 0.05
            reasons.append("Long context")

        if len(messages) > 4:
            score += 0.05
            reasons.append(f"Multi-turn ({len(messages)} msgs)")

        # Clamp score to 0-1
        score = max(0.0, min(1.0, score))

        if not reasons:
            reasons.append("Standard complexity")

        return score, reasons, task_info

    @classmethod
    def analyze_legacy(cls, messages: List[Dict[str, Any]], model: str) -> Tuple[float, List[str]]:
        """
        Legacy analyze method for backward compatibility.
        Returns only score and reasons (without task_info).
        """
        score, reasons, _ = cls.analyze(messages, model, use_semantic=True)
        return score, reasons


class SmartRouter:
    """Smart routing service for model selection."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.analyzer = ComplexityAnalyzer()

    async def get_tenant_settings(self, tenant_id: UUID) -> Optional[Tenant]:
        """Get tenant routing settings."""
        result = await self.db.execute(
            select(Tenant).where(Tenant.id == tenant_id)
        )
        return result.scalar_one_or_none()

    def get_provider_for_model(self, model: str) -> str:
        """Determine provider from model name."""
        model_lower = model.lower()
        if "gpt" in model_lower or "openai" in model_lower:
            return "openai"
        elif "claude" in model_lower or "anthropic" in model_lower:
            return "anthropic"
        return "unknown"

    def get_alternative_model(self, original_model: str, provider: str, to_premium: bool = False) -> Optional[str]:
        """Get alternative model in same provider."""
        if provider not in MODEL_TIERS:
            return None

        tiers = MODEL_TIERS[provider]
        original_lower = original_model.lower()

        # Check if original is premium
        is_premium = any(original_lower in m.lower() or m.lower() in original_lower for m in tiers["premium"])

        if is_premium and not to_premium:
            # Route to standard tier
            return tiers["standard"][0] if tiers["standard"] else None
        elif not is_premium and to_premium:
            # Route to premium tier
            return tiers["premium"][0] if tiers["premium"] else None

        return None

    def get_task_optimized_model(self, task_type: str, available_models: Optional[List[str]] = None) -> Tuple[Optional[str], str]:
        """
        Get the best model for a specific task type.

        Args:
            task_type: The detected task type (coding, analysis, etc.)
            available_models: Optional list of models that are configured/available

        Returns:
            Tuple of (model_name, reason) or (None, reason) if no match
        """
        recommendations = TASK_MODEL_RECOMMENDATIONS.get(task_type, TASK_MODEL_RECOMMENDATIONS["simple"])

        # If no filter, return first recommendation
        if not available_models:
            model, reason = recommendations[0]
            return model, reason

        # Find first available model from recommendations
        available_lower = [m.lower() for m in available_models]
        for model, reason in recommendations:
            if model.lower() in available_lower:
                return model, reason

        # Fallback: return first available model
        return available_models[0] if available_models else None, "No task-specific model available"

    def estimate_savings(self, original_model: str, routed_model: str, estimated_tokens: int = 1000) -> Decimal:
        """Estimate cost savings from routing."""
        original_cost = MODEL_COSTS.get(original_model, {"input": 0, "output": 0})
        routed_cost = MODEL_COSTS.get(routed_model, {"input": 0, "output": 0})

        # Assume 30% input, 70% output tokens
        input_tokens = estimated_tokens * 0.3
        output_tokens = estimated_tokens * 0.7

        original_total = (input_tokens * original_cost["input"] + output_tokens * original_cost["output"]) / 1_000_000
        routed_total = (input_tokens * routed_cost["input"] + output_tokens * routed_cost["output"]) / 1_000_000

        savings = original_total - routed_total
        return Decimal(str(max(0, savings)))

    async def route_request(
        self,
        tenant_id: UUID,
        original_model: str,
        messages: List[Dict[str, Any]],
        end_customer_id: Optional[UUID] = None,
        request_id: Optional[str] = None,
        use_semantic: bool = True,
    ) -> Dict[str, Any]:
        """
        Determine optimal model routing for a request.

        Uses ML-based semantic task classification for routing decisions.
        No keyword-based heuristics - ML provides better accuracy.

        Returns dict with:
        - routed_model: The model to use
        - routing_applied: Whether routing changed the model
        - complexity_score: The analyzed complexity
        - task_type: Detected task type (coding, analysis, etc.)
        - routing_reason: Explanation of routing decision
        - estimated_savings: Estimated cost savings in USD
        """
        tenant = await self.get_tenant_settings(tenant_id)

        # Default response (no routing)
        result = {
            "routed_model": original_model,
            "routing_applied": False,
            "complexity_score": None,
            "complexity_reasons": [],
            "task_type": None,
            "task_confidence": 0.0,
            "semantic_routing_used": False,
            "routing_reason": "Routing disabled",
            "estimated_savings_usd": Decimal("0"),
        }

        if not tenant or not tenant.smart_routing_enabled:
            return result

        # Get routing strategy settings
        strategy = ROUTING_STRATEGIES.get(tenant.routing_strategy, ROUTING_STRATEGIES["cost_optimized"])
        threshold = strategy["complexity_threshold"]

        # Analyze complexity with semantic classification
        complexity_score, complexity_reasons, task_info = self.analyzer.analyze(
            messages, original_model, use_semantic=use_semantic
        )
        result["complexity_score"] = complexity_score
        result["complexity_reasons"] = complexity_reasons
        result["task_type"] = task_info.get("task_type")
        result["task_confidence"] = task_info.get("task_confidence", 0.0)
        result["semantic_routing_used"] = task_info.get("semantic_available", False)

        # Determine provider
        provider = self.get_provider_for_model(original_model)
        task_type = task_info.get("task_type", "simple")
        task_str = f"[{task_type}] " if task_type else ""

        # ML-based routing: route to cheaper model when semantic score is low
        if complexity_score < threshold:
            alternative = self.get_alternative_model(original_model, provider, to_premium=False)
            if alternative and alternative.lower() != original_model.lower():
                result["routed_model"] = alternative
                result["routing_applied"] = True
                result["routing_reason"] = f"{task_str}ML Semantic: score ({complexity_score:.2f}) - routed to {alternative}"
                result["estimated_savings_usd"] = self.estimate_savings(original_model, alternative)
            else:
                result["routing_reason"] = f"{task_str}Low score but no cheaper alternative available"
        else:
            result["routing_reason"] = f"{task_str}ML Semantic: score ({complexity_score:.2f}) above threshold ({threshold}) - using original model"

        # Record the routing decision
        await self.record_decision(
            tenant_id=tenant_id,
            end_customer_id=end_customer_id,
            original_model=original_model,
            routed_model=result["routed_model"],
            routing_applied=result["routing_applied"],
            routing_reason=result["routing_reason"],
            complexity_score=complexity_score,
            complexity_reasons=complexity_reasons,
            estimated_savings_usd=result["estimated_savings_usd"],
            request_id=request_id,
        )

        return result

    async def record_decision(
        self,
        tenant_id: UUID,
        original_model: str,
        routed_model: str,
        routing_applied: bool,
        routing_reason: str,
        complexity_score: float,
        complexity_reasons: List[str],
        estimated_savings_usd: Decimal,
        end_customer_id: Optional[UUID] = None,
        request_id: Optional[str] = None,
        routellm_win_rate: Optional[float] = None,
        routellm_used: bool = False,
        routellm_confident: bool = False,
    ) -> RoutingDecision:
        """Record a routing decision for analytics."""
        decision = RoutingDecision(
            tenant_id=tenant_id,
            end_customer_id=end_customer_id,
            original_model=original_model,
            routed_model=routed_model,
            routing_applied=routing_applied,
            routing_reason=routing_reason,
            complexity_score=complexity_score,
            complexity_reasons=complexity_reasons,
            estimated_savings_usd=estimated_savings_usd,
            request_id=request_id,
            routellm_win_rate=Decimal(str(routellm_win_rate)) if routellm_win_rate is not None else None,
            routellm_used=routellm_used,
            routellm_confident=routellm_confident,
        )
        self.db.add(decision)
        await self.db.commit()
        await self.db.refresh(decision)
        return decision

    async def route_request_with_routellm(
        self,
        tenant_id: UUID,
        original_model: str,
        messages: List[Dict[str, Any]],
        end_customer_id: Optional[UUID] = None,
        request_id: Optional[str] = None,
        use_semantic: bool = True,
        use_routellm: bool = True,
    ) -> Dict[str, Any]:
        """
        ML-based routing using RouteLLM win-rate prediction.

        Routing Pipeline (ML-only, no keywords):
        1. RouteLLM (Primary) - ML win-rate prediction (~85% cost savings at 95% quality)
        2. Semantic Classification (Fallback) - Embedding-based task classification

        Decision logic:
        - If RouteLLM is available & confident → trust its prediction
        - If RouteLLM unavailable → use semantic task classification
        - No keyword-based heuristics for better accuracy

        Returns dict with all routing decision metadata.
        """
        tenant = await self.get_tenant_settings(tenant_id)

        result = {
            "routed_model": original_model,
            "routing_applied": False,
            "complexity_score": None,
            "complexity_reasons": [],
            "task_type": None,
            "task_confidence": 0.0,
            "semantic_routing_used": False,
            "routellm_used": False,
            "routellm_win_rate": None,
            "routellm_confident": False,
            "routing_reason": "Routing disabled",
            "estimated_savings_usd": Decimal("0"),
        }

        if not tenant or not tenant.smart_routing_enabled:
            return result

        # Get routing strategy settings
        strategy = ROUTING_STRATEGIES.get(
            tenant.routing_strategy,
            ROUTING_STRATEGIES["cost_optimized"]
        )
        complexity_threshold = strategy["complexity_threshold"]

        # Get RouteLLM threshold (per-tenant setting or default)
        routellm_threshold = float(tenant.routellm_threshold) if tenant.routellm_threshold else ROUTELLM_DEFAULT_THRESHOLD

        # Step 1: ML-Based Semantic Task Analysis
        complexity_score, complexity_reasons, task_info = self.analyzer.analyze(
            messages, original_model, use_semantic=use_semantic
        )
        result["complexity_score"] = complexity_score
        result["complexity_reasons"] = complexity_reasons
        result["task_type"] = task_info.get("task_type")
        result["task_confidence"] = task_info.get("task_confidence", 0.0)
        result["semantic_routing_used"] = task_info.get("semantic_available", False)

        # Step 2: RouteLLM Win-Rate Prediction (if enabled)
        provider = self.get_provider_for_model(original_model)
        routellm_decision = None

        if use_routellm and getattr(tenant, 'routellm_enabled', False) and is_routellm_available():
            try:
                routellm_service = get_routellm_service()
                if routellm_service.is_available():
                    routellm_decision = routellm_service.route(
                        messages=messages,
                        provider=provider,
                        threshold=routellm_threshold,
                    )
                    result["routellm_used"] = True
                    result["routellm_win_rate"] = routellm_decision["strong_win_rate"]
                    result["routellm_confident"] = routellm_decision["is_confident"]
            except Exception as e:
                logger.warning(f"RouteLLM routing failed: {e}")

        # Step 3: Combined Decision Logic
        task_type = task_info.get("task_type", "simple")
        task_str = f"[{task_type}] " if task_type else ""

        should_route_cheap = False
        routing_signal = "complexity"

        # Decision priority:
        # 1. If RouteLLM is confident, trust its prediction
        # 2. Otherwise, use semantic complexity score
        if routellm_decision and routellm_decision["is_confident"]:
            should_route_cheap = not routellm_decision["use_strong"]
            routing_signal = "routellm"
            win_rate = routellm_decision["strong_win_rate"]
        else:
            should_route_cheap = complexity_score < complexity_threshold
            routing_signal = "semantic"

        if should_route_cheap:
            alternative = self.get_alternative_model(original_model, provider, to_premium=False)
            if alternative and alternative.lower() != original_model.lower():
                result["routed_model"] = alternative
                result["routing_applied"] = True

                if routing_signal == "routellm":
                    result["routing_reason"] = (
                        f"{task_str}RouteLLM: P(strong wins)={win_rate:.3f} < {routellm_threshold:.3f} "
                        f"- routed to {alternative}"
                    )
                else:
                    result["routing_reason"] = (
                        f"{task_str}ML Semantic: score ({complexity_score:.2f}) < {complexity_threshold} "
                        f"- routed to {alternative}"
                    )

                result["estimated_savings_usd"] = self.estimate_savings(original_model, alternative)
            else:
                result["routing_reason"] = f"{task_str}Low complexity but no cheaper alternative available"
        else:
            if routing_signal == "routellm":
                result["routing_reason"] = (
                    f"{task_str}RouteLLM: P(strong wins)={win_rate:.3f} >= {routellm_threshold:.3f} "
                    f"- using original model"
                )
            else:
                result["routing_reason"] = (
                    f"{task_str}ML Semantic: score ({complexity_score:.2f}) >= threshold ({complexity_threshold}) "
                    f"- using original model"
                )

        # Record the routing decision
        await self.record_decision(
            tenant_id=tenant_id,
            end_customer_id=end_customer_id,
            original_model=original_model,
            routed_model=result["routed_model"],
            routing_applied=result["routing_applied"],
            routing_reason=result["routing_reason"],
            complexity_score=complexity_score,
            complexity_reasons=complexity_reasons,
            estimated_savings_usd=result["estimated_savings_usd"],
            request_id=request_id,
            routellm_win_rate=result.get("routellm_win_rate"),
            routellm_used=result.get("routellm_used", False),
            routellm_confident=result.get("routellm_confident", False),
        )

        return result

    async def get_routing_stats(
        self,
        tenant_id: UUID,
        days: int = 30,
    ) -> Dict[str, Any]:
        """Get routing statistics for a tenant."""
        cutoff = datetime.utcnow() - timedelta(days=days)

        # Total decisions
        total_result = await self.db.execute(
            select(func.count(RoutingDecision.id))
            .where(RoutingDecision.tenant_id == tenant_id)
            .where(RoutingDecision.event_timestamp >= cutoff)
        )
        total_decisions = total_result.scalar() or 0

        # Routed decisions
        routed_result = await self.db.execute(
            select(func.count(RoutingDecision.id))
            .where(RoutingDecision.tenant_id == tenant_id)
            .where(RoutingDecision.event_timestamp >= cutoff)
            .where(RoutingDecision.routing_applied == True)
        )
        routed_decisions = routed_result.scalar() or 0

        # Total estimated savings
        savings_result = await self.db.execute(
            select(func.sum(RoutingDecision.estimated_savings_usd))
            .where(RoutingDecision.tenant_id == tenant_id)
            .where(RoutingDecision.event_timestamp >= cutoff)
            .where(RoutingDecision.routing_applied == True)
        )
        total_savings = savings_result.scalar() or Decimal("0")

        # Average complexity
        avg_complexity_result = await self.db.execute(
            select(func.avg(RoutingDecision.complexity_score))
            .where(RoutingDecision.tenant_id == tenant_id)
            .where(RoutingDecision.event_timestamp >= cutoff)
        )
        avg_complexity = avg_complexity_result.scalar() or 0

        # Model distribution
        model_dist_result = await self.db.execute(
            select(
                RoutingDecision.routed_model,
                func.count(RoutingDecision.id).label("count")
            )
            .where(RoutingDecision.tenant_id == tenant_id)
            .where(RoutingDecision.event_timestamp >= cutoff)
            .group_by(RoutingDecision.routed_model)
        )
        model_distribution = {row[0]: row[1] for row in model_dist_result.fetchall()}

        return {
            "period_days": days,
            "total_decisions": total_decisions,
            "routed_decisions": routed_decisions,
            "routing_rate": (routed_decisions / total_decisions * 100) if total_decisions > 0 else 0,
            "total_estimated_savings_usd": float(total_savings),
            "average_complexity_score": float(avg_complexity) if avg_complexity else 0,
            "model_distribution": model_distribution,
        }
