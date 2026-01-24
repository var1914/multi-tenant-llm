"""
Smart Model Routing Service.

Analyzes request complexity and routes to the most cost-effective model
while maintaining quality for complex tasks.

Combines keyword-based heuristics with semantic task classification
for improved routing accuracy.
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

logger = logging.getLogger(__name__)


# Model tier definitions (complexity threshold -> model)
MODEL_TIERS = {
    "openai": {
        "premium": ["gpt-4o", "gpt-4-turbo", "gpt-4"],
        "standard": ["gpt-4o-mini", "gpt-3.5-turbo"],
    },
    "anthropic": {
        "premium": ["claude-sonnet-4", "claude-3-5-sonnet", "claude-3-opus"],
        "standard": ["claude-3-haiku", "claude-3-sonnet"],
    }
}

# Model cost per 1M tokens (input/output) for savings estimation
MODEL_COSTS = {
    "gpt-4o": {"input": 2.50, "output": 10.00},
    "gpt-4o-mini": {"input": 0.15, "output": 0.60},
    "gpt-4-turbo": {"input": 10.00, "output": 30.00},
    "gpt-4": {"input": 30.00, "output": 60.00},
    "gpt-3.5-turbo": {"input": 0.50, "output": 1.50},
    "claude-sonnet-4": {"input": 3.00, "output": 15.00},
    "claude-3-5-sonnet": {"input": 3.00, "output": 15.00},
    "claude-3-opus": {"input": 15.00, "output": 75.00},
    "claude-3-haiku": {"input": 0.25, "output": 1.25},
    "claude-3-sonnet": {"input": 3.00, "output": 15.00},
}

# Routing strategies
ROUTING_STRATEGIES = {
    "cost_optimized": {
        "description": "Aggressively route simple tasks to cheaper models",
        "complexity_threshold": 0.5,  # Route to cheaper if below this
    },
    "balanced": {
        "description": "Balance between cost and quality",
        "complexity_threshold": 0.35,
    },
    "quality_first": {
        "description": "Only route very simple tasks to cheaper models",
        "complexity_threshold": 0.2,
    },
}


class ComplexityAnalyzer:
    """
    Analyzes request complexity using a hybrid approach:
    1. Semantic task classification (embedding-based)
    2. Keyword-based heuristics (fallback/supplement)
    """

    # Keywords indicating complex tasks
    COMPLEX_KEYWORDS = [
        r"\banalyze\b", r"\bcompare\b", r"\bcontrast\b", r"\bevaluate\b",
        r"\bexplain.*detail", r"\bstep.by.step\b", r"\breason\b", r"\bproof\b",
        r"\bderive\b", r"\bprove\b", r"\bcritique\b", r"\bdebug\b",
        r"\barchitect\b", r"\bdesign\b", r"\boptimize\b", r"\brefactor\b",
        r"\bmathematic", r"\balgorithm\b", r"\bcode review\b",
    ]

    # Keywords indicating simple tasks
    SIMPLE_KEYWORDS = [
        r"\btranslate\b", r"\bsummarize\b", r"\blist\b", r"\bformat\b",
        r"\bconvert\b", r"\bextract\b", r"\bclassify\b", r"\bcategorize\b",
        r"\byes.or.no\b", r"\btrue.or.false\b", r"\bsimple\b",
        r"\bquick\b", r"\bbrief\b", r"\bshort\b",
    ]

    @classmethod
    def analyze(
        cls,
        messages: List[Dict[str, Any]],
        model: str,
        use_semantic: bool = True,
    ) -> Tuple[float, List[str], Dict[str, Any]]:
        """
        Analyze complexity of a request using hybrid approach.

        Args:
            messages: List of message dicts
            model: The requested model
            use_semantic: Whether to use semantic classification

        Returns:
            Tuple of (complexity_score 0-1, list of reasons, task_info dict)
        """
        reasons = []
        score = 0.5  # Start at neutral
        task_info = {
            "task_type": None,
            "task_confidence": 0.0,
            "semantic_available": is_semantic_router_available(),
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

        text_lower = text_content.lower()

        # STEP 1: Semantic Task Classification (if available)
        if use_semantic and is_semantic_router_available():
            try:
                classifier = get_semantic_classifier()
                semantic_result = classifier.analyze_with_task(messages)

                task_info["task_type"] = semantic_result["task_type"]
                task_info["task_confidence"] = semantic_result["task_confidence"]

                # Apply complexity adjustment based on task type
                complexity_adj = semantic_result["complexity_adjustment"]
                score += complexity_adj
                reasons.append(f"Task: {semantic_result['task_type']} ({semantic_result['recommended_tier']})")

            except Exception as e:
                logger.warning(f"Semantic classification failed: {e}")

        # STEP 2: Keyword-based heuristics (supplement/fallback)
        complex_count = sum(1 for pattern in cls.COMPLEX_KEYWORDS if re.search(pattern, text_lower))
        if complex_count > 0:
            complexity_boost = min(0.2, complex_count * 0.05)  # Reduced weight when semantic is used
            score += complexity_boost
            reasons.append(f"Complex keywords ({complex_count})")

        simple_count = sum(1 for pattern in cls.SIMPLE_KEYWORDS if re.search(pattern, text_lower))
        if simple_count > 0:
            simplicity_reduction = min(0.2, simple_count * 0.05)
            score -= simplicity_reduction
            reasons.append(f"Simple keywords ({simple_count})")

        # STEP 3: Structural heuristics
        word_count = len(text_content.split())
        if word_count < 50:
            score -= 0.05
            reasons.append("Short request")
        elif word_count > 500:
            score += 0.05
            reasons.append("Long request")

        if len(messages) > 4:
            score += 0.05
            reasons.append(f"Multi-turn ({len(messages)} msgs)")

        if re.search(r"```|def |function |class |import |require\(", text_content):
            score += 0.1
            reasons.append("Code blocks detected")

        # System prompt complexity
        system_messages = [m for m in messages if m.get("role") == "system"]
        if system_messages:
            system_text = " ".join(m.get("content", "") for m in system_messages if isinstance(m.get("content"), str))
            if len(system_text) > 500:
                score += 0.05
                reasons.append("Complex system prompt")

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
        score, reasons, _ = cls.analyze(messages, model, use_semantic=False)
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

        Uses hybrid analysis combining:
        - Semantic task classification (embedding-based)
        - Keyword heuristics (fallback/supplement)

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
        strategy = ROUTING_STRATEGIES.get(tenant.routing_strategy, ROUTING_STRATEGIES["balanced"])
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

        # Check if we should route to a cheaper model
        if complexity_score < threshold:
            alternative = self.get_alternative_model(original_model, provider, to_premium=False)
            if alternative and alternative.lower() != original_model.lower():
                result["routed_model"] = alternative
                result["routing_applied"] = True

                # Build informative reason
                task_str = f"[{task_info.get('task_type', 'unknown')}] " if task_info.get("task_type") else ""
                result["routing_reason"] = f"{task_str}Low complexity ({complexity_score:.2f}) - routed to {alternative}"
                result["estimated_savings_usd"] = self.estimate_savings(original_model, alternative)
            else:
                result["routing_reason"] = f"Low complexity but no cheaper alternative available"
        else:
            task_str = f"[{task_info.get('task_type', 'unknown')}] " if task_info.get("task_type") else ""
            result["routing_reason"] = f"{task_str}Complexity ({complexity_score:.2f}) above threshold ({threshold}) - using original model"

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
        )
        self.db.add(decision)
        await self.db.commit()
        await self.db.refresh(decision)
        return decision

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
