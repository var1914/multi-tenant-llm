"""
TokenTrail Custom Callback for LiteLLM Proxy.

This callback handler automatically tracks all LLM usage to the TokenTrail backend.
It intercepts successful completions and sends usage data for billing purposes.
It also integrates with Smart Routing to optimize model selection.

Usage:
1. Mount this file in the LiteLLM container
2. Set LITELLM_CALLBACKS=tokentrail_callback.TokenTrailCallback in environment
3. Configure TOKENTRAIL_API_URL and TOKENTRAIL_INTERNAL_API_KEY
"""

import os
import httpx
import asyncio
from datetime import datetime
from typing import Optional, Any, Dict
from decimal import Decimal

# LiteLLM imports
from litellm.integrations.custom_logger import CustomLogger
from litellm import completion_cost

# FastAPI HTTPException for blocking requests
from fastapi import HTTPException


class TokenTrailCallback(CustomLogger):
    """
    Custom callback handler that sends usage events to TokenTrail backend.
    Also handles smart routing decisions.
    """

    def __init__(self):
        self.api_url = os.getenv("TOKENTRAIL_API_URL", "http://api:8000")
        self.internal_key = os.getenv("TOKENTRAIL_INTERNAL_API_KEY", "internal-api-key")
        self.enabled = os.getenv("TOKENTRAIL_CALLBACK_ENABLED", "true").lower() == "true"
        self.smart_routing_enabled = os.getenv("TOKENTRAIL_SMART_ROUTING", "true").lower() == "true"

        # HTTP client for async requests
        self._client: Optional[httpx.AsyncClient] = None

        # Cache for routing decisions (request_id -> routed_model)
        self._routing_cache: Dict[str, Dict] = {}

        print(f"[TokenTrail] Callback initialized - API URL: {self.api_url}, Enabled: {self.enabled}, Smart Routing: {self.smart_routing_enabled}", flush=True)

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
        1. Validate API key and get tenant info
        2. Check budget limits - block if exceeded
        3. Apply smart routing if enabled
        """
        if not self.enabled:
            return data

        try:
            metadata = data.get("metadata", {}) or {}

            # STEP 0: Validate API key and get tenant_id if not already set
            tenant_id = metadata.get("tenant_id")
            if not tenant_id:
                # Try to extract API key from user_api_key_dict (UserAPIKeyAuth object)
                api_key = None

                if user_api_key_dict:
                    # LiteLLM passes UserAPIKeyAuth object, not dict - use getattr
                    if hasattr(user_api_key_dict, 'api_key'):
                        api_key = getattr(user_api_key_dict, 'api_key', None)
                    elif hasattr(user_api_key_dict, 'token'):
                        api_key = getattr(user_api_key_dict, 'token', None)

                # Fallback: try to get from proxy_server_request headers
                if not api_key:
                    litellm_params = data.get("litellm_params", {}) or {}
                    proxy_request = litellm_params.get("proxy_server_request", {}) or {}
                    headers = proxy_request.get("headers", {}) or {}
                    auth_header = headers.get("authorization") or headers.get("Authorization") or ""
                    if auth_header.startswith("Bearer "):
                        api_key = auth_header.replace("Bearer ", "")

                # Validate TokenTrail API key (tt_live_* or tt_test_*)
                if api_key and api_key.startswith(("tt_live_", "tt_test_")):
                    try:
                        client = await self._get_client()
                        validate_response = await client.post(
                            f"{self.api_url}/api/v1/internal/validate-key",
                            json={"api_key": api_key},
                            headers={
                                "X-Internal-Key": self.internal_key,
                                "Content-Type": "application/json"
                            },
                            timeout=3.0,
                        )

                        if validate_response.status_code == 200:
                            key_info = validate_response.json()
                            if key_info.get("valid"):
                                tenant_id = key_info.get("tenant_id")
                                metadata["tenant_id"] = tenant_id
                                metadata["tenant_slug"] = key_info.get("tenant_slug")
                                metadata["key_environment"] = key_info.get("environment")
                                data["metadata"] = metadata
                                print(f"[TokenTrail] Validated key for tenant: {key_info.get('tenant_slug')}", flush=True)
                            else:
                                print(f"[TokenTrail] Invalid API key", flush=True)
                                raise Exception("Invalid API key")
                    except Exception as e:
                        print(f"[TokenTrail] Key validation error: {str(e)}", flush=True)
                        # Continue without tenant_id - usage won't be tracked

            if not tenant_id:
                print(f"[TokenTrail] No tenant_id - usage won't be tracked", flush=True)
                return data

            # Extract customer_id - in pre_call_hook, data contains 'user' directly
            customer_id = (
                metadata.get("customer_id") or
                metadata.get("user_id") or
                data.get("user") or
                "default_customer"
            )

            # STEP 1: Check budget limits
            client = await self._get_client()
            budget_response = await client.post(
                f"{self.api_url}/api/v1/internal/check-budget",
                json={
                    "tenant_id": tenant_id,
                    "customer_id": customer_id,
                },
                headers={
                    "X-Internal-Key": self.internal_key,
                    "Content-Type": "application/json"
                },
                timeout=3.0,
            )

            if budget_response.status_code == 200:
                budget_check = budget_response.json()
                if budget_check.get("blocked"):
                    # Block the request using HTTPException (required by LiteLLM to actually block)
                    reason = budget_check.get("reason", "Budget limit exceeded")
                    print(f"[TokenTrail] Request blocked: {reason}", flush=True)
                    raise HTTPException(status_code=429, detail=f"Budget limit exceeded: {reason}")

            # STEP 2: Apply smart routing if enabled
            if not self.smart_routing_enabled:
                return data

            model = data.get("model", "")
            messages = data.get("messages", [])

            # Generate request ID for tracking
            import uuid
            request_id = str(uuid.uuid4())
            metadata["tokentrail_request_id"] = request_id
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

                # Cache the routing decision for the success callback
                self._routing_cache[request_id] = routing

                if routing.get("routing_applied"):
                    routed_model = routing.get("routed_model")
                    print(f"[TokenTrail] Smart Routing: {model} -> {routed_model} (complexity: {routing.get('complexity_score', 'N/A')})", flush=True)
                    data["model"] = routed_model
                    metadata["original_model"] = model
                    metadata["routed_model"] = routed_model
                    data["metadata"] = metadata

            return data

        except HTTPException:
            # Re-raise HTTPException to block the request
            raise
        except Exception as e:
            print(f"[TokenTrail] Pre-call hook error: {str(e)}", flush=True)
            return data  # Return original data on other errors

    async def async_log_success_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """
        Called after a successful LLM completion.
        Sends usage data to TokenTrail backend.
        """
        if not self.enabled:
            return

        try:
            print(f"[TokenTrail] Success callback triggered", flush=True)

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

            # If no tenant_id, try to extract from API key in headers
            if not tenant_id:
                proxy_request = litellm_params.get("proxy_server_request", {}) or {}
                headers = proxy_request.get("headers", {}) or {}
                auth_header = headers.get("authorization") or headers.get("Authorization") or ""

                if auth_header.startswith("Bearer "):
                    api_key = auth_header.replace("Bearer ", "")
                    if api_key.startswith(("tt_live_", "tt_test_")):
                        try:
                            client = await self._get_client()
                            validate_response = await client.post(
                                f"{self.api_url}/api/v1/internal/validate-key",
                                json={"api_key": api_key},
                                headers={
                                    "X-Internal-Key": self.internal_key,
                                    "Content-Type": "application/json"
                                },
                                timeout=3.0,
                            )
                            if validate_response.status_code == 200:
                                key_info = validate_response.json()
                                if key_info.get("valid"):
                                    tenant_id = key_info.get("tenant_id")
                                    print(f"[TokenTrail] Validated key for tenant: {key_info.get('tenant_slug')}", flush=True)
                        except Exception as e:
                            print(f"[TokenTrail] Key validation error in success callback: {str(e)}", flush=True)

            if not tenant_id:
                print(f"[TokenTrail] Warning: No tenant_id found - cannot track usage", flush=True)
                return

            # Calculate cost
            cost = self._calculate_cost(model, input_tokens, output_tokens)

            # Generate request ID from response if available
            request_id = getattr(response_obj, "id", None) or f"req_{start_time.timestamp()}"

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
                "metadata": {
                    "start_time": start_time.isoformat(),
                    "end_time": end_time.isoformat(),
                    "duration_ms": int((end_time - start_time).total_seconds() * 1000),
                },
                "timestamp": end_time.isoformat()
            }

            # Send to TokenTrail backend
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
                    print(f"[TokenTrail] Tracked usage: {total_tokens} tokens for customer {customer_id}", flush=True)
                else:
                    print(f"[TokenTrail] Failed to track: {result.get('message')}", flush=True)
            else:
                print(f"[TokenTrail] HTTP error {response.status_code}: {response.text}", flush=True)

        except Exception as e:
            # Don't fail the request if callback fails
            print(f"[TokenTrail] Error in callback: {str(e)}", flush=True)

    async def async_log_failure_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """
        Called after a failed LLM completion.
        We don't track failed requests for billing, but could log for monitoring.
        """
        pass

    async def async_post_call_success_hook(
        self,
        data: dict,
        user_api_key_dict: dict,
        response,
    ):
        """
        Called by LiteLLM proxy after a successful API call.
        This hook is called in the proxy context with different parameters.
        """
        print(f"[TokenTrail] post_call_success_hook triggered", flush=True)
        try:
            # Extract what we can from the data and response
            from datetime import datetime
            start_time = datetime.now()
            end_time = datetime.now()
            await self.async_log_success_event(data, response, start_time, end_time)
        except Exception as e:
            print(f"[TokenTrail] Error in post_call_success_hook: {str(e)}", flush=True)

    def log_success_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """Sync wrapper for async_log_success_event."""
        asyncio.create_task(self.async_log_success_event(kwargs, response_obj, start_time, end_time))

    def log_failure_event(self, kwargs: dict, response_obj: Any, start_time: datetime, end_time: datetime):
        """Sync wrapper for async_log_failure_event."""
        pass


# Create callback instance for LiteLLM to use
tokentrail_callback = TokenTrailCallback()
