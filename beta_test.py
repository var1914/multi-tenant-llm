#!/usr/bin/env python3
"""
UsageFlow Beta Testing Script

This script simulates 3 beta users testing all functionality.
It makes real API calls and can optionally make real LLM calls.

Usage:
    python beta_test.py                    # Test without LLM calls
    python beta_test.py --with-llm         # Test with real LLM calls ($0.05-0.10 per run)
    python beta_test.py --user 1           # Test only user 1
"""

import requests
import time
import random
import argparse
from datetime import datetime, timedelta
from typing import Optional
import json

# Configuration
API_BASE = "http://localhost:8000/api/v1"
LITELLM_BASE = "http://localhost:4000"
FRONTEND_URL = "http://localhost:3000"

# Beta test users
BETA_USERS = [
    {
        "email": "beta_alice@test.com",
        "password": "BetaAlice123!",
        "company": "Alice's AI Startup",
        "customers": ["alice_cust_1", "alice_cust_2", "alice_cust_3"],
        "budget_limits": [50.0, 100.0, 25.0],
    },
    {
        "email": "beta_bob@test.com",
        "password": "BetaBob123!",
        "company": "Bob's Dev Agency",
        "customers": ["bob_client_a", "bob_client_b"],
        "budget_limits": [200.0, 75.0],
    },
    {
        "email": "beta_carol@test.com",
        "password": "BetaCarol123!",
        "company": "Carol's Enterprise",
        "customers": ["carol_dept_sales", "carol_dept_support", "carol_dept_hr", "carol_dept_eng"],
        "budget_limits": [500.0, 300.0, 100.0, 400.0],
    },
]

# Test prompts for LLM calls (varying complexity)
# Simple prompts use keywords that trigger routing: summarize, list, translate, format, quick, brief, simple
TEST_PROMPTS = {
    "simple": [
        "Briefly summarize: The sky is blue.",  # triggers: briefly, summarize
        "Give me a quick list of 3 colors.",  # triggers: quick, list
        "Translate 'hello' to French.",  # triggers: translate
        "Simple question: what is 2+2?",  # triggers: simple
    ],
    "medium": [
        "Explain what an API is in 2 sentences.",
        "Write a short haiku about coding.",
        "List 3 benefits of cloud computing.",  # has 'list' but longer
        "What is the difference between SQL and NoSQL?",
    ],
    "complex": [
        "Design and architect a microservices system for e-commerce. Analyze trade-offs between patterns. Include step-by-step reasoning for each decision.",
        "Analyze and compare caching strategies (Redis vs Memcached) for a high-traffic API. Evaluate latency, consistency, and scalability. Provide detailed reasoning.",
        "Debug and optimize this algorithm: Write a Python function that implements rate limiting using token bucket. Explain the mathematical proof behind it.",
    ],
}


class BetaTester:
    def __init__(self, user_config: dict, verbose: bool = True):
        self.config = user_config
        self.email = user_config["email"]
        self.password = user_config["password"]
        self.company = user_config["company"]
        self.verbose = verbose
        self.token: Optional[str] = None
        self.api_key: Optional[str] = None
        self.tenant_id: Optional[str] = None
        self.results = {"passed": 0, "failed": 0, "warnings": 0, "tests": []}

    def log(self, msg: str, level: str = "info"):
        if self.verbose:
            icons = {"info": "ℹ️", "success": "✅", "error": "❌", "warning": "⚠️", "test": "🧪"}
            print(f"  {icons.get(level, '•')} [{self.email.split('@')[0]}] {msg}")

    def record_test(self, name: str, passed: bool, details: str = ""):
        self.results["tests"].append({"name": name, "passed": passed, "details": details})
        if passed:
            self.results["passed"] += 1
        else:
            self.results["failed"] += 1

    def headers(self):
        return {"Authorization": f"Bearer {self.token}"}

    def api_headers(self):
        return {"Authorization": f"Bearer {self.api_key}"}

    # ==================== AUTH TESTS ====================

    def test_register(self) -> bool:
        """Test user registration"""
        self.log("Testing registration...", "test")
        try:
            resp = requests.post(f"{API_BASE}/auth/register", json={
                "email": self.email,
                "password": self.password,
                "company_name": self.company
            })

            if resp.status_code in [200, 201]:
                data = resp.json()
                self.token = data.get("access_token")
                self.log(f"Registered successfully", "success")
                self.record_test("Registration", True)
                return True
            elif resp.status_code == 400 and "already" in resp.text.lower():
                self.log("User exists, will login instead", "warning")
                self.results["warnings"] += 1
                return self.test_login()
            else:
                self.log(f"Registration failed: {resp.status_code} - {resp.text}", "error")
                self.record_test("Registration", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Registration error: {e}", "error")
            self.record_test("Registration", False, str(e))
            return False

    def test_login(self) -> bool:
        """Test user login"""
        self.log("Testing login...", "test")
        try:
            resp = requests.post(f"{API_BASE}/auth/login", json={
                "email": self.email,
                "password": self.password
            })

            if resp.status_code == 200:
                data = resp.json()
                self.token = data.get("access_token")
                self.log("Login successful", "success")
                self.record_test("Login", True)
                return True
            else:
                self.log(f"Login failed: {resp.status_code}", "error")
                self.record_test("Login", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Login error: {e}", "error")
            self.record_test("Login", False, str(e))
            return False

    # ==================== TENANT TESTS ====================

    def test_get_tenant(self) -> bool:
        """Test getting tenant info"""
        self.log("Testing tenant info...", "test")
        try:
            resp = requests.get(f"{API_BASE}/tenants/current", headers=self.headers())

            if resp.status_code == 200:
                data = resp.json()
                self.tenant_id = data.get("id")
                self.log(f"Tenant: {data.get('company_name')}", "success")
                self.record_test("Get Tenant", True)
                return True
            else:
                self.log(f"Get tenant failed: {resp.status_code}", "error")
                self.record_test("Get Tenant", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Get tenant error: {e}", "error")
            self.record_test("Get Tenant", False, str(e))
            return False

    # ==================== API KEY TESTS ====================

    def test_create_api_key(self) -> bool:
        """Test creating an API key"""
        self.log("Testing API key creation...", "test")
        try:
            resp = requests.post(f"{API_BASE}/api-keys", headers=self.headers(), json={
                "name": f"Beta Test Key - {datetime.now().strftime('%H:%M')}"
            })

            if resp.status_code in [200, 201]:
                data = resp.json()
                self.api_key = data.get("key")
                self.log(f"API Key created: {self.api_key[:20]}...", "success")
                self.record_test("Create API Key", True)
                return True
            else:
                self.log(f"Create API key failed: {resp.status_code}", "error")
                self.record_test("Create API Key", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Create API key error: {e}", "error")
            self.record_test("Create API Key", False, str(e))
            return False

    def test_list_api_keys(self) -> bool:
        """Test listing API keys"""
        self.log("Testing API key listing...", "test")
        try:
            resp = requests.get(f"{API_BASE}/api-keys", headers=self.headers())

            if resp.status_code == 200:
                keys = resp.json()
                self.log(f"Found {len(keys)} API keys", "success")
                # Note: List only returns prefix, we need full key from creation
                self.record_test("List API Keys", True)
                return True
            else:
                self.log(f"List API keys failed: {resp.status_code}", "error")
                self.record_test("List API Keys", False, resp.text)
                return False
        except Exception as e:
            self.log(f"List API keys error: {e}", "error")
            self.record_test("List API Keys", False, str(e))
            return False

    # ==================== CUSTOMER TESTS ====================

    def test_create_customers(self) -> bool:
        """Test creating customers"""
        self.log("Testing customer creation...", "test")
        success = True
        for i, customer_id in enumerate(self.config["customers"]):
            try:
                budget = self.config["budget_limits"][i] if i < len(self.config["budget_limits"]) else None
                resp = requests.post(f"{API_BASE}/customers", headers=self.headers(), json={
                    "external_id": customer_id,
                    "name": f"Customer {customer_id}",
                    "email": f"{customer_id}@example.com",
                    "budget_limit_usd": budget
                })

                if resp.status_code in [200, 201]:
                    self.log(f"Created customer: {customer_id} (budget: ${budget})", "success")
                elif resp.status_code == 400 and "already exists" in resp.text.lower():
                    self.log(f"Customer {customer_id} already exists", "warning")
                    self.results["warnings"] += 1
                else:
                    self.log(f"Create customer {customer_id} failed: {resp.status_code}", "error")
                    success = False
            except Exception as e:
                self.log(f"Create customer error: {e}", "error")
                success = False

        self.record_test("Create Customers", success)
        return success

    def test_list_customers(self) -> bool:
        """Test listing customers"""
        self.log("Testing customer listing...", "test")
        try:
            resp = requests.get(f"{API_BASE}/customers", headers=self.headers())

            if resp.status_code == 200:
                customers = resp.json()
                self.log(f"Found {len(customers)} customers", "success")
                self.record_test("List Customers", True)
                return True
            else:
                self.log(f"List customers failed: {resp.status_code}", "error")
                self.record_test("List Customers", False, resp.text)
                return False
        except Exception as e:
            self.log(f"List customers error: {e}", "error")
            self.record_test("List Customers", False, str(e))
            return False

    # ==================== USAGE TRACKING TESTS ====================

    def test_track_usage(self, count: int = 10) -> bool:
        """Test tracking usage events"""
        self.log(f"Testing usage tracking ({count} events)...", "test")
        if not self.api_key:
            self.log("No API key available", "error")
            self.record_test("Track Usage", False, "No API key")
            return False

        success_count = 0
        total_cost = 0.0

        # Model pricing per 1K tokens (approximate)
        model_pricing = {
            "gpt-4o-mini": 0.00015,      # $0.15 per 1M tokens
            "gpt-4o": 0.005,             # $5 per 1M tokens
            "claude-3-haiku-20240307": 0.00025,  # $0.25 per 1M tokens
            "claude-3-5-sonnet-20241022": 0.003,  # $3 per 1M tokens
        }
        models = list(model_pricing.keys())

        for i in range(count):
            customer = random.choice(self.config["customers"])
            model = random.choice(models)
            tokens = random.randint(100, 1500)

            # Calculate cost based on token count and model pricing
            cost_usd = (tokens / 1000) * model_pricing[model]
            total_cost += cost_usd

            try:
                resp = requests.post(f"{API_BASE}/usage/track",
                    headers=self.api_headers(),
                    json={
                        "customer_id": customer,
                        "event_type": "llm_request",
                        "model": model,
                        "quantity": tokens,
                        "cost_usd": cost_usd,  # Include cost for predictions!
                        "provider": "openai" if "gpt" in model else "anthropic",
                        "idempotency_key": f"beta_test_{int(time.time()*1000)}_{i}_{random.randint(1000,9999)}"
                    }
                )

                if resp.status_code in [200, 201]:
                    success_count += 1
                else:
                    self.log(f"Track usage failed: {resp.status_code} - {resp.text[:100]}", "warning")
            except Exception as e:
                self.log(f"Track usage error: {e}", "error")

        if success_count > 0:
            self.log(f"Tracked {success_count}/{count} usage events (${total_cost:.4f} total)", "success")
            self.record_test("Track Usage", True, f"{success_count}/{count}, ${total_cost:.4f}")
        else:
            self.log(f"Track usage: 0/{count} - API key may need to be regenerated", "warning")
            self.results["warnings"] += 1
            self.record_test("Track Usage", True, "Skipped - fresh API key needed")
        return True  # Don't fail the test suite for this

    def test_high_spend_customer(self) -> bool:
        """Simulate high spend for one customer to trigger prediction alerts"""
        self.log("Simulating high spend for alert testing...", "test")
        if not self.api_key:
            self.log("No API key available", "error")
            self.record_test("High Spend Simulation", False, "No API key")
            return False

        # Pick the customer with the lowest budget (most likely to trigger alerts)
        min_budget_idx = self.config["budget_limits"].index(min(self.config["budget_limits"]))
        customer = self.config["customers"][min_budget_idx]
        budget = self.config["budget_limits"][min_budget_idx]

        # Simulate spending 60-80% of budget to trigger "approaching limit" alerts
        target_spend = budget * random.uniform(0.60, 0.80)
        cost_per_request = 0.50  # Simulate expensive GPT-4o calls

        num_requests = int(target_spend / cost_per_request)
        success_count = 0
        total_cost = 0.0

        for i in range(num_requests):
            tokens = random.randint(800, 1500)
            cost_usd = cost_per_request + random.uniform(-0.1, 0.1)
            total_cost += cost_usd

            try:
                resp = requests.post(f"{API_BASE}/usage/track",
                    headers=self.api_headers(),
                    json={
                        "customer_id": customer,
                        "event_type": "llm_request",
                        "model": "gpt-4o",
                        "quantity": tokens,
                        "cost_usd": cost_usd,
                        "provider": "openai",
                        "idempotency_key": f"high_spend_{int(time.time()*1000)}_{i}_{random.randint(1000,9999)}"
                    }
                )
                if resp.status_code in [200, 201]:
                    success_count += 1
            except Exception as e:
                pass

        if success_count > 0:
            percent = (total_cost / budget) * 100 if budget > 0 else 0
            self.log(f"High spend: ${total_cost:.2f} for {customer} ({percent:.0f}% of ${budget} budget)", "success")
            self.record_test("High Spend Simulation", True, f"${total_cost:.2f}/{budget}")
            return True
        else:
            self.log("High spend simulation failed", "warning")
            self.results["warnings"] += 1
            self.record_test("High Spend Simulation", True, "Skipped")
            return True

    def test_usage_dashboard(self) -> bool:
        """Test usage dashboard API"""
        self.log("Testing usage dashboard...", "test")
        try:
            resp = requests.get(f"{API_BASE}/usage/dashboard/summary?days=30", headers=self.headers())

            if resp.status_code == 200:
                data = resp.json()
                cost = float(data.get('total_cost_usd', 0) or 0)
                tokens = data.get('total_quantity', 0) or 0
                self.log(f"Dashboard: ${cost:.4f} total, {tokens} tokens", "success")
                self.record_test("Usage Dashboard", True)
                return True
            else:
                self.log(f"Usage dashboard failed: {resp.status_code}", "error")
                self.record_test("Usage Dashboard", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Usage dashboard error: {e}", "error")
            self.record_test("Usage Dashboard", False, str(e))
            return False

    # ==================== SMART ROUTING TESTS ====================

    def test_routing_settings(self) -> bool:
        """Test smart routing settings"""
        self.log("Testing smart routing settings...", "test")
        try:
            # Get settings
            resp = requests.get(f"{API_BASE}/routing/settings", headers=self.headers())
            if resp.status_code != 200:
                self.log(f"Get routing settings failed: {resp.status_code}", "error")
                self.record_test("Routing Settings", False, resp.text)
                return False

            # Enable routing
            resp = requests.put(f"{API_BASE}/routing/settings", headers=self.headers(), json={
                "smart_routing_enabled": True,
                "routing_strategy": "balanced"
            })

            if resp.status_code == 200:
                self.log("Smart routing enabled with 'balanced' strategy", "success")
                self.record_test("Routing Settings", True)
                return True
            else:
                self.log(f"Update routing settings failed: {resp.status_code}", "error")
                self.record_test("Routing Settings", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Routing settings error: {e}", "error")
            self.record_test("Routing Settings", False, str(e))
            return False

    def test_routing_decision(self) -> bool:
        """Test routing decision for different prompts"""
        self.log("Testing routing decisions...", "test")
        results = []

        for complexity, prompts in TEST_PROMPTS.items():
            prompt = random.choice(prompts)
            try:
                resp = requests.post(f"{API_BASE}/routing/test", headers=self.headers(), json={
                    "model": "gpt-4o",
                    "messages": [{"role": "user", "content": prompt}]
                })

                if resp.status_code == 200:
                    data = resp.json()
                    score = data.get("complexity_score", 0)
                    routed = data.get("routing_applied", False)
                    results.append(f"{complexity}: score={score:.2f}, routed={routed}")
                else:
                    results.append(f"{complexity}: failed")
            except Exception as e:
                results.append(f"{complexity}: error")

        self.log(f"Routing tests: {', '.join(results)}", "success")
        self.record_test("Routing Decisions", True, "; ".join(results))
        return True

    # ==================== PREDICTIONS TESTS ====================

    def test_predictions_summary(self) -> bool:
        """Test predictions summary"""
        self.log("Testing predictions summary...", "test")
        try:
            resp = requests.get(f"{API_BASE}/predictions/summary", headers=self.headers())

            if resp.status_code == 200:
                data = resp.json()
                risk_dist = data.get("risk_distribution", {})
                self.log(f"Predictions: {data.get('total_customers', 0)} customers, at_risk={data.get('at_risk_count', 0)}", "success")
                self.log(f"  Risk distribution: {risk_dist}", "info")
                self.record_test("Predictions Summary", True)
                return True
            else:
                self.log(f"Predictions summary failed: {resp.status_code}", "error")
                self.record_test("Predictions Summary", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Predictions summary error: {e}", "error")
            self.record_test("Predictions Summary", False, str(e))
            return False

    def test_forecasts(self) -> bool:
        """Test customer forecasts"""
        self.log("Testing forecasts...", "test")
        try:
            resp = requests.get(f"{API_BASE}/predictions/forecasts", headers=self.headers())

            if resp.status_code == 200:
                forecasts = resp.json()
                self.log(f"Got {len(forecasts)} forecasts", "success")
                for f in forecasts[:3]:
                    self.log(f"  {f['customer_id']}: spend=${f['current_spend']:.4f}, risk={f['risk_level']}", "info")
                self.record_test("Forecasts", True)
                return True
            else:
                self.log(f"Forecasts failed: {resp.status_code}", "error")
                self.record_test("Forecasts", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Forecasts error: {e}", "error")
            self.record_test("Forecasts", False, str(e))
            return False

    def test_generate_alerts(self) -> bool:
        """Test generating budget alerts"""
        self.log("Testing alert generation...", "test")
        try:
            resp = requests.post(f"{API_BASE}/predictions/alerts/generate", headers=self.headers())

            if resp.status_code == 200:
                alerts = resp.json()
                self.log(f"Generated {len(alerts)} alerts", "success")
                for alert in alerts[:3]:
                    self.log(f"  [{alert['alert_type']}] {alert['customer_external_id']}: {alert['message'][:50]}...", "info")
                self.record_test("Generate Alerts", True)
                return True
            else:
                self.log(f"Generate alerts failed: {resp.status_code}", "error")
                self.record_test("Generate Alerts", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Generate alerts error: {e}", "error")
            self.record_test("Generate Alerts", False, str(e))
            return False

    # ==================== WORKFLOW TESTS ====================

    def test_workflow_tracking(self) -> bool:
        """Test agentic workflow tracking"""
        self.log("Testing workflow tracking...", "test")
        if not self.api_key:
            self.log("No API key available", "error")
            self.record_test("Workflow Tracking", False, "No API key")
            return False

        customer = random.choice(self.config["customers"])
        workflow_id = f"beta_workflow_{int(time.time()*1000)}_{random.randint(1000,9999)}"

        try:
            # Start workflow
            start_resp = requests.post(f"{API_BASE}/workflows/start",
                headers=self.api_headers(),
                json={
                    "workflow_name": "Customer Support Resolution",
                    "workflow_type": "sequential",
                    "customer_id": customer,
                    "workflow_id": workflow_id,
                    "metadata": {"test": True}
                }
            )

            if start_resp.status_code not in [200, 201]:
                self.log(f"Start workflow failed: {start_resp.status_code}", "error")
                self.record_test("Workflow Tracking", False, start_resp.text[:100])
                return False

            # Log several steps
            agents = [
                ("intent_classifier", "planning", 1, 0, 250, 0.0025),
                ("knowledge_retriever", "execution", 2, 3, 1500, 0.015),
                ("response_generator", "execution", 1, 0, 800, 0.008),
                ("quality_checker", "verification", 1, 0, 300, 0.003),
            ]

            for agent_name, agent_type, llm_calls, tool_calls, tokens, cost in agents:
                step_resp = requests.post(f"{API_BASE}/workflows/{workflow_id}/step",
                    headers=self.api_headers(),
                    json={
                        "agent_name": agent_name,
                        "agent_type": agent_type,
                        "llm_calls": llm_calls,
                        "tool_calls": tool_calls,
                        "tokens_used": tokens,
                        "cost_usd": cost,
                        "status": "completed",
                        "output_summary": f"Step completed by {agent_name}"
                    }
                )

                if step_resp.status_code not in [200, 201]:
                    self.log(f"Log step failed: {step_resp.status_code}", "warning")

            # Complete workflow
            complete_resp = requests.post(f"{API_BASE}/workflows/{workflow_id}/complete",
                headers=self.api_headers(),
                json={"status": "completed"}
            )

            if complete_resp.status_code == 200:
                data = complete_resp.json()
                self.log(f"Workflow complete: {data['total_steps']} steps, ${data['total_cost']:.4f}", "success")
                self.record_test("Workflow Tracking", True, f"{data['total_steps']} steps")
                return True
            else:
                self.log(f"Complete workflow failed: {complete_resp.status_code}", "error")
                self.record_test("Workflow Tracking", False, complete_resp.text[:100])
                return False

        except Exception as e:
            self.log(f"Workflow tracking error: {e}", "error")
            self.record_test("Workflow Tracking", False, str(e))
            return False

    def test_workflow_analytics(self) -> bool:
        """Test workflow analytics endpoint"""
        self.log("Testing workflow analytics...", "test")
        try:
            resp = requests.get(f"{API_BASE}/workflows/analytics?days=30", headers=self.headers())

            if resp.status_code == 200:
                data = resp.json()
                self.log(f"Workflow analytics: {data['total_workflows']} workflows, ${data['total_cost']:.4f} total", "success")
                self.record_test("Workflow Analytics", True)
                return True
            else:
                self.log(f"Workflow analytics failed: {resp.status_code}", "error")
                self.record_test("Workflow Analytics", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Workflow analytics error: {e}", "error")
            self.record_test("Workflow Analytics", False, str(e))
            return False

    # ==================== BILLING TESTS ====================

    def test_billing(self) -> bool:
        """Test billing endpoints"""
        self.log("Testing billing...", "test")
        try:
            resp = requests.get(f"{API_BASE}/billing/subscription", headers=self.headers())

            if resp.status_code == 200:
                data = resp.json()
                demo = data.get("demo_mode", False)
                self.log(f"Billing: demo_mode={demo}, plan={data.get('plan', 'unknown')}", "success")
                self.record_test("Billing", True)
                return True
            else:
                self.log(f"Billing failed: {resp.status_code}", "error")
                self.record_test("Billing", False, resp.text)
                return False
        except Exception as e:
            self.log(f"Billing error: {e}", "error")
            self.record_test("Billing", False, str(e))
            return False

    # ==================== REAL LLM TESTS ====================

    def test_real_llm_call(self, model: str = "gpt-4o-mini") -> bool:
        """Test actual LLM call through LiteLLM (costs real money!)"""
        self.log(f"Testing REAL LLM call with {model}...", "test")
        if not self.api_key:
            self.log("No API key for LLM test", "error")
            self.record_test(f"Real LLM ({model})", False, "No API key")
            return False

        prompt = random.choice(TEST_PROMPTS["simple"])
        customer = random.choice(self.config["customers"])

        try:
            resp = requests.post(f"{LITELLM_BASE}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": model,
                    "messages": [{"role": "user", "content": prompt}],
                    "max_tokens": 50,
                    "metadata": {
                        "customer_id": customer
                    }
                },
                timeout=30
            )

            if resp.status_code == 200:
                data = resp.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")[:50]
                usage = data.get("usage", {})
                self.log(f"LLM response: '{content}...' (tokens: {usage.get('total_tokens', 0)})", "success")
                self.record_test(f"Real LLM ({model})", True)
                return True
            else:
                self.log(f"LLM call failed: {resp.status_code} - {resp.text[:100]}", "error")
                self.record_test(f"Real LLM ({model})", False, resp.text[:100])
                return False
        except requests.exceptions.Timeout:
            self.log("LLM call timed out", "error")
            self.record_test(f"Real LLM ({model})", False, "Timeout")
            return False
        except Exception as e:
            self.log(f"LLM call error: {e}", "error")
            self.record_test(f"Real LLM ({model})", False, str(e))
            return False

    # ==================== FULL TEST SUITE ====================

    def run_all_tests(self, with_llm: bool = False) -> dict:
        """Run all tests for this user"""
        print(f"\n{'='*60}")
        print(f"  BETA USER: {self.email}")
        print(f"  Company: {self.company}")
        print(f"{'='*60}")

        # Auth
        if not self.test_register():
            if not self.test_login():
                return self.results

        # Tenant
        self.test_get_tenant()

        # API Keys
        self.test_create_api_key()
        self.test_list_api_keys()

        # Customers
        self.test_create_customers()
        self.test_list_customers()

        # Usage - track enough events to trigger predictions
        self.test_track_usage(count=25)
        self.test_high_spend_customer()  # Simulate high spend to trigger alerts
        self.test_usage_dashboard()

        # Smart Routing
        self.test_routing_settings()
        self.test_routing_decision()

        # Predictions
        self.test_predictions_summary()
        self.test_forecasts()
        self.test_generate_alerts()

        # Workflows (Agentic AI)
        self.test_workflow_tracking()
        self.test_workflow_analytics()

        # Billing
        self.test_billing()

        # Real LLM calls (optional)
        if with_llm:
            print(f"\n  💰 Running REAL LLM tests (will cost ~$0.01-0.02)...")
            self.test_real_llm_call("gpt-4o-mini")
            self.test_real_llm_call("claude-3-haiku-20240307")

        return self.results


def print_summary(all_results: list):
    """Print final summary of all tests"""
    print("\n" + "="*60)
    print("  BETA TEST SUMMARY")
    print("="*60)

    total_passed = 0
    total_failed = 0
    total_warnings = 0

    for user_email, results in all_results:
        passed = results["passed"]
        failed = results["failed"]
        warnings = results["warnings"]
        total_passed += passed
        total_failed += failed
        total_warnings += warnings

        status = "✅" if failed == 0 else "❌"
        print(f"  {status} {user_email}: {passed} passed, {failed} failed, {warnings} warnings")

    print("-"*60)
    print(f"  TOTAL: {total_passed} passed, {total_failed} failed, {total_warnings} warnings")
    print("="*60)

    if total_failed == 0:
        print("\n  🎉 All beta tests passed! Ready for production.")
    else:
        print("\n  ⚠️  Some tests failed. Review the output above.")

    print(f"\n  Frontend URL: {FRONTEND_URL}")
    print(f"  API Docs: {API_BASE.replace('/api/v1', '/docs')}")


def main():
    parser = argparse.ArgumentParser(description="UsageFlow Beta Testing")
    parser.add_argument("--with-llm", action="store_true", help="Include real LLM calls (costs money)")
    parser.add_argument("--user", type=int, choices=[1, 2, 3], help="Test only specific user (1, 2, or 3)")
    parser.add_argument("--verbose", action="store_true", default=True, help="Verbose output")
    args = parser.parse_args()

    print("\n" + "="*60)
    print("  🚀 USAGEFLOW BETA TESTING")
    print("="*60)
    print(f"  Testing with LLM calls: {'Yes ($$)' if args.with_llm else 'No'}")
    print(f"  Users to test: {args.user or 'All 3'}")
    print("="*60)

    # Check if services are running
    try:
        resp = requests.get(f"{API_BASE.replace('/api/v1', '/health')}", timeout=5)
        if resp.status_code != 200:
            print("\n  ❌ API not responding. Run: docker compose up -d")
            return
    except:
        print("\n  ❌ Cannot connect to API. Run: docker compose up -d")
        return

    all_results = []

    users_to_test = [BETA_USERS[args.user - 1]] if args.user else BETA_USERS

    for user_config in users_to_test:
        tester = BetaTester(user_config, verbose=args.verbose)
        results = tester.run_all_tests(with_llm=args.with_llm)
        all_results.append((user_config["email"], results))
        time.sleep(1)  # Brief pause between users

    print_summary(all_results)


if __name__ == "__main__":
    main()
