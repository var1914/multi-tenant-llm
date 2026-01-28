"""
Semantic Router Service for intelligent task classification.

Uses sentence embeddings to classify prompts into task categories,
enabling more accurate model routing than keyword matching.

MEMORY OPTIMIZATION:
- Set SEMANTIC_ROUTER_DISABLED=true to completely disable semantic routing
- The embedding model (~80MB) is loaded ONLY on first classification
- Uses all-MiniLM-L6-v2 for fast inference (~15ms per classification)
"""

import os
import logging
from typing import Optional, Tuple, List, Dict, Any
from functools import lru_cache

logger = logging.getLogger(__name__)

# Environment variable to disable semantic router entirely (saves ~80-150MB RAM)
SEMANTIC_ROUTER_DISABLED = os.getenv("SEMANTIC_ROUTER_DISABLED", "false").lower() in ("true", "1", "yes")

# Flag to check if semantic_router library is importable
SEMANTIC_ROUTER_IMPORTABLE = False
Route = None
HuggingFaceEncoder = None
RouteLayer = None  # Was SemanticRouter in older versions

if not SEMANTIC_ROUTER_DISABLED:
    try:
        from semantic_router import Route
        from semantic_router.encoders import HuggingFaceEncoder
        # In semantic-router 0.0.72+, RouteLayer replaces SemanticRouter
        from semantic_router.layer import RouteLayer
        SEMANTIC_ROUTER_IMPORTABLE = True
        logger.info("Semantic router library available (lazy loading enabled)")
    except ImportError as e:
        logger.warning(f"semantic-router not installed or import failed: {e}")
    except Exception as e:
        # Python 3.12 has compatibility issues with semantic-router's Pydantic v1 usage
        logger.warning(f"semantic-router failed to import (Python 3.12 compatibility): {e}")
else:
    logger.info("Semantic router disabled via SEMANTIC_ROUTER_DISABLED environment variable")


# Task categories with example utterances for embedding-based classification
# Include both short phrases AND paragraph-style examples for better matching
TASK_ROUTES = {
    "coding": [
        # Short phrases
        "write a function that",
        "write a Python function",
        "implement this algorithm",
        "debug this code",
        "fix this error",
        "refactor this class",
        "write unit tests for",
        "create a REST API endpoint",
        "build a component in React",
        # Paragraph-style prompts (more realistic)
        "I need you to implement a middleware that handles authentication and rate limiting",
        "Build me a service that processes data and stores it in the database",
        "Create an API endpoint that accepts JSON and validates the input",
        "Write a comprehensive test suite for our authentication module",
        "Implement a caching layer using Redis for our application",
        "I am building a SaaS application and need you to write the backend code",
        "Please implement the following feature with proper error handling",
        "Create a database migration script for our PostgreSQL schema",
        "Build a webhook handler that processes incoming events",
        "Write the code to integrate with this third-party API",
    ],
    "analysis": [
        "analyze this data",
        "compare these options",
        "evaluate the tradeoffs",
        "what are the implications of",
        "explain the pros and cons",
        "assess the risks of",
        "review this architecture",
        "critique this approach",
        "identify the bottlenecks",
        "find patterns in",
        "investigate why",
        "root cause analysis",
        "performance analysis of",
        "security review of",
        "explain the reasoning behind",
    ],
    "reasoning": [
        "step by step explain",
        "walk me through",
        "prove that",
        "derive the formula",
        "mathematical proof",
        "logical reasoning",
        "solve this problem",
        "figure out how to",
        "what would happen if",
        "hypothetically speaking",
        "think through this scenario",
        "chain of thought",
        "break down the problem",
    ],
    "creative": [
        "write a story about",
        "create a poem",
        "brainstorm ideas for",
        "come up with names for",
        "generate marketing copy",
        "write a blog post about",
        "create a tagline",
        "draft an email",
        "write dialogue for",
        "imagine a scenario where",
        "design a logo concept",
        "creative writing prompt",
    ],
    "translation": [
        "translate this to",
        "translate from English to",
        "how do you say in",
        "convert to Spanish",
        "French translation of",
        "translate the following",
        "in German this would be",
        "Japanese translation",
        "Chinese characters for",
        "localize this text",
    ],
    "summarization": [
        "summarize this article",
        "give me the key points",
        "TLDR of this",
        "brief summary of",
        "condense this into",
        "main takeaways from",
        "executive summary",
        "in a nutshell",
        "sum up the main ideas",
        "highlight the important parts",
    ],
    "extraction": [
        "extract the names from",
        "pull out the dates",
        "find all the emails in",
        "list the key entities",
        "identify the topics",
        "extract structured data",
        "parse the information",
        "get the phone numbers from",
        "find all URLs in",
        "extract keywords from",
    ],
    "simple": [
        "what is",
        "define",
        "who is",
        "when was",
        "where is",
        "hello",
        "hi there",
        "thanks",
        "thank you",
        "yes",
        "no",
        "okay",
        "got it",
        "list the",
        "format this as",
        "convert to JSON",
        "what time is it",
        "how many",
        "spell check",
        "fix the grammar",
    ],
}

# Model recommendations per task type
# Maps task -> (preferred_tier, confidence_boost)
TASK_MODEL_MAPPING = {
    "coding": ("premium", 0.3),        # Coding needs strong models
    "analysis": ("premium", 0.25),     # Analysis benefits from reasoning
    "reasoning": ("premium", 0.35),    # Multi-step reasoning needs premium
    "creative": ("standard", 0.0),     # Creative can use standard
    "translation": ("standard", -0.2), # Translation is straightforward
    "summarization": ("standard", -0.15),
    "extraction": ("standard", -0.2),
    "simple": ("standard", -0.3),      # Simple queries use budget models
}


class SemanticTaskClassifier:
    """
    Classifies prompts into task categories using semantic embeddings.

    Uses the all-MiniLM-L6-v2 model for fast (~15ms) classification.
    Falls back to keyword matching if semantic-router is not available.

    LAZY LOADING: The embedding model is NOT loaded until the first classification.
    This saves ~80-150MB of memory on servers that don't use semantic routing.
    """

    _instance: Optional['SemanticTaskClassifier'] = None
    _router: Optional[Any] = None
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
        # NOTE: Do NOT initialize router here - lazy load on first use

    def _ensure_router(self) -> bool:
        """Lazy-load the router on first use. Returns True if available."""
        if self._load_attempted:
            return self._router is not None

        self._load_attempted = True

        if not SEMANTIC_ROUTER_IMPORTABLE:
            logger.warning("Semantic router not available, using fallback")
            return False

        try:
            logger.info("Lazy-loading semantic router embedding model (this may take a moment)...")
            # Use lightweight model for fast inference
            encoder = HuggingFaceEncoder(
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )

            # Create routes from task definitions
            routes = []
            for task_name, utterances in TASK_ROUTES.items():
                route = Route(
                    name=task_name,
                    utterances=utterances,
                )
                routes.append(route)

            # RouteLayer replaced SemanticRouter in semantic-router 0.0.72+
            self._router = RouteLayer(
                encoder=encoder,
                routes=routes,
            )
            # Lower threshold for better recall (default is 0.5)
            self._router.score_threshold = 0.3
            logger.info("Semantic router initialized with local index (threshold=0.3)")
            return True

        except Exception as e:
            logger.error(f"Failed to initialize semantic router: {e}")
            self._router = None
            return False

    def is_loaded(self) -> bool:
        """Check if the embedding model is already loaded in memory."""
        return self._router is not None

    def classify(self, text: str) -> Tuple[str, float]:
        """
        Classify a prompt into a task category.

        NOTE: This will lazy-load the embedding model on first call (~80MB, may take a few seconds).

        Args:
            text: The prompt text to classify

        Returns:
            Tuple of (task_name, confidence_score)
        """
        # Lazy-load the router if not already loaded
        if not self._ensure_router():
            return self._fallback_classify(text)

        try:
            result = self._router(text)
            if result and result.name:
                # Semantic router returns the route with highest similarity
                return result.name, 0.8  # Default confidence for semantic match
            return "simple", 0.5
        except Exception as e:
            logger.warning(f"Semantic classification failed: {e}")
            return self._fallback_classify(text)

    def _fallback_classify(self, text: str) -> Tuple[str, float]:
        """Fallback to simple keyword matching."""
        text_lower = text.lower()

        # Check each category for keyword matches
        best_match = "simple"
        best_score = 0

        for task_name, utterances in TASK_ROUTES.items():
            matches = sum(1 for u in utterances if u.lower() in text_lower)
            if matches > best_score:
                best_score = matches
                best_match = task_name

        confidence = min(0.7, 0.3 + (best_score * 0.1))
        return best_match, confidence

    def get_model_recommendation(self, task_type: str) -> Tuple[str, float]:
        """
        Get model tier recommendation for a task type.

        Returns:
            Tuple of (tier: "premium"|"standard", complexity_adjustment)
        """
        return TASK_MODEL_MAPPING.get(task_type, ("standard", 0.0))

    def analyze_with_task(
        self,
        messages: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Analyze messages and return task classification with model recommendation.

        Args:
            messages: List of message dicts with 'role' and 'content'

        Returns:
            Dict with task_type, confidence, tier, complexity_adjustment
        """
        # Extract text from messages
        text_parts = []
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                text_parts.append(content)
            elif isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and item.get("type") == "text":
                        text_parts.append(item.get("text", ""))

        combined_text = " ".join(text_parts)

        # Truncate for efficiency (first 1000 chars is usually enough)
        if len(combined_text) > 1000:
            combined_text = combined_text[:1000]

        # Classify
        task_type, confidence = self.classify(combined_text)
        tier, complexity_adj = self.get_model_recommendation(task_type)

        return {
            "task_type": task_type,
            "task_confidence": confidence,
            "recommended_tier": tier,
            "complexity_adjustment": complexity_adj,
        }


# Singleton instance getter
@lru_cache(maxsize=1)
def get_semantic_classifier() -> SemanticTaskClassifier:
    """Get or create the singleton SemanticTaskClassifier instance."""
    return SemanticTaskClassifier()


def is_semantic_router_available() -> bool:
    """Check if semantic router library is available (not necessarily loaded yet)."""
    return SEMANTIC_ROUTER_IMPORTABLE and not SEMANTIC_ROUTER_DISABLED
