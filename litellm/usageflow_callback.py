"""
UsageFlow Custom Callback for LiteLLM Proxy.

This callback handler automatically tracks all LLM usage to the UsageFlow backend.
It intercepts successful completions and sends usage data for billing purposes.
It also integrates with Smart Routing to optimize model selection.

Usage:
1. Mount this file in the LiteLLM container
2. Set LITELLM_CALLBACKS=usageflow_callback.UsageFlowCallback in environment
3. Configure USAGEFLOW_API_URL and USAGEFLOW_INTERNAL_API_KEY
"""

import os
import httpx
import asyncio
import time
from datetime import datetime
from typing import Optional, Any, Dict, Tuple
from decimal import Decimal

# LiteLLM imports
from litellm.integrations.custom_logger import CustomLogger
from litellm import completion_cost


class UsageFlowCallback(CustomLogger):
    """
    Custom callback handler that sends usage events to UsageFlow backend.
    Also handles smart routing decisions.
    """

    def __init__(self):
        self.api_url = os.getenv("USAGEFLOW_API_URL", "http://api:8000")
        self.internal_key = os.getenv("USAGEFLOW_INTERNAL_API_KEY", "internal-api-key")
        self.enabled = os.getenv("USAGEFLOW_CALLBACK_ENABLED", "true").lower() == "true"
        self.smart_routing_enabled = os.getenv("USAGEFLOW_SMART_ROUTING", "true").lower() == "true"

        # HTTP client for async requests
        self._client: Optional[httpx.AsyncClient] = None

        # Cache for routing decisions with TTL: Dict[request_id, Tuple[routing_data, timestamp]]
        self._routing_cache: Dict[str, Tuple[Dict, float]] = {}
        self._cache_ttl_seconds = 300  # 5 minutes TTL
        self._cache_max_size = 10000   # Max entries to prevent memory bloat

        print(f"[UsageFlow] Callback initialized - API URL: {self.api_url}, Enabled: {self.enabled}, Smart Routing: {self.smart_routing_enabled}")

    def _cleanup_routing_cache(self):
        """Remove expired cache entries and enforce max size."""
        current_time = time.time()

        # Remove expired entries
        expired_keys = [
            k for k, (_, ts) in self._routing_cache.items()
            if current_time - ts > self._cache_ttl_seconds
        ]
        for k in expired_keys:
            del self._routing_cache[k]

        # Evict oldest entries if over max size
        if len(self._routing_cache) > self._cache_max_size:
            sorted_items = sorted(
                self._routing_cache.items(),
                key=lambda x: x[1][1]  # Sort by timestamp
            )
            # Remove oldest entries to get back under limit
            for k, _ in sorted_items[:len(self._routing_cache) - self._cache_max_size]:
                del self._routing_cache[k]

    def _cache_routing_decision(self, request_id: str, routing: Dict):
        """Cache a routing decision with timestamp."""
        self._routing_cache[request_id] = (routing, time.time())
        # Periodic cleanup (every 100 cache additions)
        if len(self._routing_cache) % 100 == 0:
            self._cleanup_routing_cache()

    def _get_cached_routing(self, request_id: str) -> Optional[Dict]:
        """Get and remove a cached routing decision."""
        if request_id in self._routing_cache:
            routing, _ = self._routing_cache.pop(request_id)
            return routing
        return None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create the async HTTP client."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=10.0)
        return self._client

    def _extract_customer_id(self, kwargs: dict, response_obj: Any) -> str:
        """
        Extract customer ID from the request metadata.

        LiteLLM allows passing custom metadata in the request.
        We look for customer_id in the following order:
        1. metadata.customer_id
        2. metadata.user_id
        3. user field (OpenAI format)
        4. Default to "unknown"
        """
        metadata = kwargs.get("metadata", {}) or {}
        litellm_params = kwargs.get("litellm_params", {}) or {}
        proxy_server_request = litellm_params.get("proxy_server_request", {}) or {}
        body = proxy_server_request.get("body", {}) or {}

        # Check various places for customer ID
        customer_id = (
            metadata.get("customer_id") or
            metadata.get("user_id") or
            body.get("user") or
            kwargs.get("user") or
            "default_customer"
        )

        return str(customer_id)

    def _extract_tenant_id(self, kwargs: dict) -> Optional[str]:
        """
        Extract tenant ID from the request metadata.

        The tenant_id is set during authentication and stored in metadata.
        """
        metadata = kwargs.get("metadata", {}) or {}
        litellm_params = kwargs.get("litellm_params", {}) or {}

        return (
            metadata.get("tenant_id") or
            litellm_params.get("metadata", {}).get("tenant_id")
        )

    def _calculate_cost(self, model: str, input_tokens: int, output_tokens: int) -> Decimal:
        """
        Calculate the cost of the completion using LiteLLM's pricing.
        Falls back to 0 if pricing data not available.
        """
        try:
            cost = completion_cost(
                model=model,
                prompt_tokens=input_tokens,
                completion_tokens=output_tokens
            )
            return Decimal(str(cost)) if cost else Decimal("0")
        except Exception:
            # Model pricing not found, return 0
            return Decimal("0")

    async def async_pre_call_hook(
        self,
        user_api_key_dict: dict,
        cache: Any,
        data: dict,
        call_type: str,
    ) -> Optional[dict]:
        """
        Called before making the LLM API call.
        Used for smart routing - modifies the model if needed.
        """
        if not self.enabled or not self.smart_routing_enabled:
            return data

        try:
            # Extract tenant info from metadata
            metadata = data.get("metadata", {}) or {}
            tenant_id = metadata.get("tenant_id")

            if not tenant_id:
                return data

            model = data.get("model", "")
            messages = data.get("messages", [])
            customer_id = self._extract_customer_id({"metadata": metadata}, None)

            # Generate request ID for tracking
            import uuid
            request_id = str(uuid.uuid4())
            metadata["usageflow_request_id"] = request_id
            data["metadata"] = metadata

            # Call routing API
            client = await self._get_client()
            response = await client.post(
                f"{self.api_url}/api/v1/internal/route",
                json={
                    "tenant_id": tenant_id,
                    "model": model,
                    "messages": messages,
                    "customer_id": customer_id,
                    "request_id": request_id,
                },
                headers={
                    "X-Internal-Key": self.internal_key,
                    "Content-Type": "application/json"
                },
                timeout=5.0,  # Short timeout for routing
            )

            if response.status_code == 200:
                routing = response.json()

                # Cache the routing decision for the success callback (with TTL)
                self._cache_routing_decision(request_id, routing)

                if routing.get("routing_applied"):
                    routed_model = routing.get("routed_model")
                    print(f"[UsageFlow] Smart Routing: {model} -> {routed_model} (complexity: {routing.get('complexity_score', 'N/A')})")
                    data["model"] = routed_model
                    metadata["original_model"] = model
                    metadata["routed_model"] = routed_model
                    data["metadata"] = metadata

            return data

        except Exception as e:
            print(f"[UsageFlow] Smart routing error: {str(e)}")
            return data  # Return original data on error

    async def async_log_success_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """
        Called after a successful LLM completion.
        Sends usage data to UsageFlow backend.
        """
        if not self.enabled:
            return

        try:
            # Extract model info
            model = kwargs.get("model", "unknown")
            litellm_params = kwargs.get("litellm_params", {}) or {}
            custom_llm_provider = litellm_params.get("custom_llm_provider", "")

            # Determine provider
            if "anthropic" in model.lower() or custom_llm_provider == "anthropic":
                provider = "anthropic"
            elif "gpt" in model.lower() or "openai" in model.lower() or custom_llm_provider == "openai":
                provider = "openai"
            else:
                provider = custom_llm_provider or "unknown"

            # Extract token counts from response
            usage = getattr(response_obj, "usage", None)
            if usage:
                input_tokens = getattr(usage, "prompt_tokens", 0) or 0
                output_tokens = getattr(usage, "completion_tokens", 0) or 0
                total_tokens = getattr(usage, "total_tokens", 0) or input_tokens + output_tokens
            else:
                input_tokens = 0
                output_tokens = 0
                total_tokens = 0

            # Extract IDs
            customer_id = self._extract_customer_id(kwargs, response_obj)
            tenant_id = self._extract_tenant_id(kwargs)

            if not tenant_id:
                print(f"[UsageFlow] Warning: No tenant_id found in request metadata")
                return

            # Calculate cost
            cost = self._calculate_cost(model, input_tokens, output_tokens)

            # Generate request ID from response if available
            request_id = getattr(response_obj, "id", None) or f"req_{start_time.timestamp()}"

            # Get and clean up cached routing decision (prevents memory leak)
            metadata = kwargs.get("metadata", {}) or {}
            usageflow_request_id = metadata.get("usageflow_request_id")
            cached_routing = None
            if usageflow_request_id:
                cached_routing = self._get_cached_routing(usageflow_request_id)

            # Prepare payload metadata
            payload_metadata = {
                "start_time": start_time.isoformat(),
                "end_time": end_time.isoformat(),
                "duration_ms": int((end_time - start_time).total_seconds() * 1000),
            }

            # Include routing info if available
            if cached_routing:
                payload_metadata["routing_applied"] = cached_routing.get("routing_applied", False)
                payload_metadata["original_model"] = cached_routing.get("original_model")
                payload_metadata["complexity_score"] = cached_routing.get("complexity_score")
                payload_metadata["routellm_win_rate"] = cached_routing.get("routellm_win_rate")
                payload_metadata["routellm_used"] = cached_routing.get("routellm_used", False)

            # Prepare payload
            payload = {
                "tenant_id": tenant_id,
                "customer_id": customer_id,
                "model": model,
                "provider": provider,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost_usd": str(cost),
                "request_id": request_id,
                "metadata": payload_metadata,
                "timestamp": end_time.isoformat()
            }

            # Send to UsageFlow backend
            client = await self._get_client()
            response = await client.post(
                f"{self.api_url}/api/v1/internal/litellm-usage",
                json=payload,
                headers={
                    "X-Internal-Key": self.internal_key,
                    "Content-Type": "application/json"
                }
            )

            if response.status_code == 200:
                result = response.json()
                if result.get("success"):
                    print(f"[UsageFlow] Tracked usage: {total_tokens} tokens for customer {customer_id}")
                else:
                    print(f"[UsageFlow] Failed to track: {result.get('message')}")
            else:
                print(f"[UsageFlow] HTTP error {response.status_code}: {response.text}")

        except Exception as e:
            # Don't fail the request if callback fails
            print(f"[UsageFlow] Error in callback: {str(e)}")

    async def async_log_failure_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """
        Called after a failed LLM completion.
        We don't track failed requests for billing, but could log for monitoring.
        """
        pass

    def log_success_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """Sync wrapper for async_log_success_event."""
        asyncio.create_task(self.async_log_success_event(kwargs, response_obj, start_time, end_time))

    def log_failure_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """Sync wrapper for async_log_failure_event."""
        pass


# Create callback instance for LiteLLM to use
usageflow_callback = UsageFlowCallback()
