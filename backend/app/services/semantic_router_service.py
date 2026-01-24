"""
Semantic Router Service for intelligent task classification.

Uses sentence embeddings to classify prompts into task categories,
enabling more accurate model routing than keyword matching.
"""

import logging
from typing import Optional, Tuple, List, Dict, Any
from functools import lru_cache

logger = logging.getLogger(__name__)

# Flag to check if semantic_router is available
SEMANTIC_ROUTER_AVAILABLE = False
Route = None
HuggingFaceEncoder = None
SemanticRouter = None

try:
    from semantic_router import Route
    from semantic_router.encoders import HuggingFaceEncoder
    from semantic_router.routers import SemanticRouter
    SEMANTIC_ROUTER_AVAILABLE = True
except ImportError:
    logger.warning("semantic-router not installed. Using fallback classification.")
except Exception as e:
    # Python 3.12 has compatibility issues with semantic-router's Pydantic v1 usage
    logger.warning(f"semantic-router failed to load (Python 3.12 compatibility): {e}")


# Task categories with example utterances for embedding-based classification
TASK_ROUTES = {
    "coding": [
        "write a function that",
        "implement this algorithm",
        "debug this code",
        "fix this error",
        "refactor this class",
        "optimize this script",
        "write unit tests for",
        "create a REST API endpoint",
        "parse this JSON",
        "handle this exception",
        "write a regex pattern",
        "implement the interface",
        "create a database query",
        "build a component in React",
        "write Python code to",
        "JavaScript function that",
        "SQL query to find",
        "TypeScript interface for",
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
    """

    _instance: Optional['SemanticTaskClassifier'] = None
    _router: Optional[Any] = None
    _initialized: bool = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._initialize_router()

    def _initialize_router(self):
        """Initialize the semantic router with task routes."""
        if not SEMANTIC_ROUTER_AVAILABLE:
            logger.warning("Semantic router not available, using fallback")
            return

        try:
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

            self._router = SemanticRouter(
                encoder=encoder,
                routes=routes,
            )
            logger.info("Semantic router initialized successfully")

        except Exception as e:
            logger.error(f"Failed to initialize semantic router: {e}")
            self._router = None

    def classify(self, text: str) -> Tuple[str, float]:
        """
        Classify a prompt into a task category.

        Args:
            text: The prompt text to classify

        Returns:
            Tuple of (task_name, confidence_score)
        """
        if self._router is None:
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
    """Check if semantic router is available."""
    return SEMANTIC_ROUTER_AVAILABLE
