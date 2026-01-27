"""
RouteLLM Service for ML-based routing predictions.

Uses the MF (Matrix Factorization) router from RouteLLM to predict
whether a strong model is needed for a given query. This enables
intelligent cost-quality tradeoffs with ~85% cost savings at 95% quality.

RouteLLM paper: https://arxiv.org/abs/2406.18665

MEMORY OPTIMIZATION:
- Set ROUTELLM_DISABLED=true to completely disable RouteLLM
- The MF router weights (~100MB) are loaded ONLY on first prediction
- Use is_routellm_available() to check before making predictions
"""

import os
import logging
from typing import Optional, Dict, Any, Tuple, List
from functools import lru_cache

logger = logging.getLogger(__name__)

# Environment variable to disable RouteLLM entirely (saves ~100-200MB RAM)
ROUTELLM_DISABLED = os.getenv("ROUTELLM_DISABLED", "false").lower() in ("true", "1", "yes")

# RouteLLM availability flag (library importable, not necessarily loaded)
ROUTELLM_IMPORTABLE = False
Controller = None

if not ROUTELLM_DISABLED:
    try:
        from routellm.controller import Controller
        ROUTELLM_IMPORTABLE = True
        logger.info("RouteLLM library available (lazy loading enabled)")
    except ImportError:
        logger.warning("routellm not installed. Install with: pip install routellm")
    except Exception as e:
        logger.warning(f"routellm failed to import: {e}")
else:
    logger.info("RouteLLM disabled via ROUTELLM_DISABLED environment variable")


# Model pair configurations per provider
# Maps provider -> {strong: premium_model, weak: budget_model}
MODEL_PAIRS = {
    "openai": {
        "strong": "gpt-4o",
        "weak": "gpt-4o-mini",
    },
    "anthropic": {
        "strong": "claude-sonnet-4-20250514",
        "weak": "claude-3-5-haiku-20241022",
    },
    "google": {
        "strong": "gemini-1.5-pro",
        "weak": "gemini-1.5-flash",
    },
}

# Default threshold from RouteLLM paper (calibrated for MF router)
# At this threshold: 95% quality retention with ~85% cost savings
DEFAULT_THRESHOLD = 0.11593


class RouteLLMService:
    """
    Wrapper service for RouteLLM's MF (Matrix Factorization) router.

    The MF router predicts P(strong model wins) for a given query based on
    training data from LLM comparison platforms. If P < threshold, route to
    the weaker (cheaper) model.

    Performance characteristics:
    - Latency: ~20ms per prediction (model loaded in memory)
    - Accuracy: 85% cost reduction at 95% quality (MT Bench)
    - Model size: ~100MB (MF router weights)

    LAZY LOADING: The model is NOT loaded until the first prediction is made.
    This saves memory on servers that don't use RouteLLM routing.

    Usage:
        service = get_routellm_service()
        if service.is_available():
            result = service.route(messages, provider="openai")
            if not result["use_strong"]:
                # Route to cheaper model
    """

    _instance: Optional['RouteLLMService'] = None
    _controller: Optional[Any] = None
    _initialized: bool = False
    _load_attempted: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        # NOTE: Do NOT initialize controller here - lazy load on first use

    def _ensure_controller(self) -> bool:
        """Lazy-load the controller on first use. Returns True if available."""
        if self._load_attempted:
            return self._controller is not None

        self._load_attempted = True

        if not ROUTELLM_IMPORTABLE:
            logger.warning("RouteLLM not available, routing will use fallback")
            return False

        try:
            logger.info("Lazy-loading RouteLLM MF router (this may take a moment)...")
            # MF router is recommended - fastest with best accuracy tradeoff
            # Using OpenAI models as reference (training was done on these)
            self._controller = Controller(
                routers=["mf"],
                strong_model="gpt-4o",
                weak_model="gpt-4o-mini",
            )
            logger.info("RouteLLM controller initialized with MF router")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize RouteLLM: {e}")
            self._controller = None
            return False

    def is_available(self) -> bool:
        """Check if RouteLLM can be used (library importable, not necessarily loaded yet)."""
        return ROUTELLM_IMPORTABLE and not ROUTELLM_DISABLED

    def is_loaded(self) -> bool:
        """Check if RouteLLM model is already loaded in memory."""
        return self._controller is not None

    def _format_messages(self, messages: List[Dict[str, Any]]) -> str:
        """
        Format messages into a single string for RouteLLM.

        RouteLLM expects a prompt string. We concatenate all message
        contents with role prefixes.
        """
        parts = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")

            if isinstance(content, str):
                parts.append(f"{role}: {content}")
            elif isinstance(content, list):
                # Handle multi-modal content (text parts only)
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        parts.append(f"{role}: {item.get('text', '')}")

        return "\n".join(parts)

    def predict_strong_win_rate(
        self,
        messages: List[Dict[str, Any]],
    ) -> Tuple[float, bool]:
        """
        Predict the probability that a strong model would win.

        The MF router uses matrix factorization on preference data to
        estimate when the expensive model provides meaningfully better output.

        NOTE: This will lazy-load the model on first call (~100MB, may take a few seconds).

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Tuple of (win_rate 0-1, is_confident bool)
            - win_rate: P(strong model provides better response)
            - is_confident: True if prediction is reliable (model available)
        """
        # Lazy-load the controller if not already loaded
        if not self._ensure_controller():
            # Fallback: 50% means "uncertain, don't route"
            return 0.5, False

        try:
            # Format messages for RouteLLM
            prompt = self._format_messages(messages)

            # Get prediction from MF router
            # The router internally calls calculate_strong_win_rate
            router = self._controller.routers["mf"]
            score = router.calculate_strong_win_rate(
                [{"role": "user", "content": prompt}]
            )

            return float(score), True

        except Exception as e:
            logger.warning(f"RouteLLM prediction failed: {e}")
            return 0.5, False

    def route(
        self,
        messages: List[Dict[str, Any]],
        provider: str = "openai",
        threshold: float = DEFAULT_THRESHOLD,
    ) -> Dict[str, Any]:
        """
        Get routing decision for a request.

        Decision logic:
        - If P(strong wins) >= threshold: use strong model (quality matters)
        - If P(strong wins) < threshold: use weak model (save cost)

        Args:
            messages: List of message dicts
            provider: Provider name (openai, anthropic, google)
            threshold: Win-rate threshold (default: 0.11593)

        Returns:
            Dict with:
            - routed_model: The recommended model name
            - strong_model: The strong model name for this provider
            - weak_model: The weak model name for this provider
            - strong_win_rate: Predicted probability strong model wins (0-1)
            - use_strong: Whether to use strong model (bool)
            - is_confident: Whether prediction is confident (bool)
            - threshold: The threshold used for decision
        """
        win_rate, is_confident = self.predict_strong_win_rate(messages)

        # Get model pair for provider
        pair = MODEL_PAIRS.get(provider.lower(), MODEL_PAIRS["openai"])
        strong_model = pair["strong"]
        weak_model = pair["weak"]

        # Decision: use strong if win_rate >= threshold
        use_strong = win_rate >= threshold
        routed_model = strong_model if use_strong else weak_model

        return {
            "routed_model": routed_model,
            "strong_model": strong_model,
            "weak_model": weak_model,
            "strong_win_rate": win_rate,
            "use_strong": use_strong,
            "is_confident": is_confident,
            "threshold": threshold,
        }

    def get_model_pair(self, provider: str) -> Dict[str, str]:
        """Get the strong/weak model pair for a provider."""
        return MODEL_PAIRS.get(provider.lower(), MODEL_PAIRS["openai"])


# Singleton getter
@lru_cache(maxsize=1)
def get_routellm_service() -> RouteLLMService:
    """Get or create the singleton RouteLLMService instance."""
    return RouteLLMService()


def is_routellm_available() -> bool:
    """Check if RouteLLM library is available (not necessarily loaded yet)."""
    return ROUTELLM_IMPORTABLE and not ROUTELLM_DISABLED
