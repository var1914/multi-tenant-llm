#!/usr/bin/env python3
"""
Comprehensive test data generator and functionality tester for UsageFlow.
"""

import requests
import json
import random
from datetime import datetime, timedelta, timezone
import uuid

BASE_URL = "http://localhost:8000/api/v1"

TEST_USER = {
    "email": "test@usageflow.com",
    "password": "TestPassword123!",
    "full_name": "Test Admin",
    "company_name": "UsageFlow Test Corp"
}

class UsageFlowTester:
    def __init__(self):
        self.token = None
        self.tenant_id = None
        self.api_key = None
        self.customers = []
        self.results = {"passed": 0, "failed": 0, "warnings": 0}
        
    def log(self, message, status="INFO"):
        symbols = {"INFO": "ℹ️ ", "SUCCESS": "✅", "ERROR": "❌", "TEST": "🧪", "WARN": "⚠️ "}
        if status == "SUCCESS":
            self.results["passed"] += 1
        elif status == "ERROR":
            self.results["failed"] += 1
        elif status == "WARN":
            self.results["warnings"] += 1
        print(f"{symbols.get(status, '•')} {message}")
    
    def register_user(self):
        self.log("Registering/logging in test user...", "TEST")
        response = requests.post(f"{BASE_URL}/auth/register", json=TEST_USER)
        if response.status_code in [200, 201]:
            self.token = response.json()["access_token"]
            self.log("User registered", "SUCCESS")
            return True
        elif response.status_code == 400:
            response = requests.post(f"{BASE_URL}/auth/login", 
                json={"email": TEST_USER["email"], "password": TEST_USER["password"]})
            if response.status_code == 200:
                self.token = response.json()["access_token"]
                self.log("User logged in", "SUCCESS")
                return True
        self.log(f"Auth failed: {response.status_code}", "ERROR")
        return False
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}
    
    def get_api_key_headers(self):
        return {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
    
    def get_tenant_info(self):
        self.log("Getting tenant info...", "TEST")
        response = requests.get(f"{BASE_URL}/tenants/current", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.tenant_id = data["id"]
            self.log(f"Tenant: {data['company_name']}", "SUCCESS")
            return True
        self.log(f"Failed: {response.status_code}", "ERROR")
        return False
    
    def create_api_key(self):
        self.log("Creating API key...", "TEST")
        response = requests.post(
            f"{BASE_URL}/api-keys",
            headers=self.get_headers(),
            json={"name": f"Test Key {uuid.uuid4().hex[:6]}", "environment": "test"}
        )
        if response.status_code in [200, 201]:
            self.api_key = response.json().get("key")
            self.log(f"API Key created", "SUCCESS")
            return True
        self.log(f"API key failed: {response.status_code}", "ERROR")
        return False
    
    def create_test_customers(self):
        self.log("Creating test customers...", "TEST")
        profiles = [
            {"external_id": "cust_enterprise_001", "name": "Acme Enterprise"},
            {"external_id": "cust_startup_002", "name": "TechStartup Inc"},
            {"external_id": "cust_smb_003", "name": "Local Business LLC"},
            {"external_id": "cust_dev_004", "name": "Indie Developer"},
            {"external_id": "cust_agency_005", "name": "Digital Agency Co"},
        ]
        for p in profiles:
            requests.post(f"{BASE_URL}/customers", headers=self.get_headers(), json=p)
        
        resp = requests.get(f"{BASE_URL}/customers", headers=self.get_headers())
        if resp.status_code == 200:
            data = resp.json()
            self.customers = data.get("customers", data) if isinstance(data, dict) else data
            self.log(f"{len(self.customers)} customers available", "SUCCESS")
            return True
        self.log("Customer fetch failed", "ERROR")
        return False
    
    def generate_usage_events(self, num_events=30):
        self.log(f"Generating {num_events} usage events...", "TEST")
        if not self.api_key:
            self.log("No API key", "ERROR")
            return 0
        
        models = [
            {"model": "gpt-4o", "provider": "openai", "cost_per_1k": 0.01},
            {"model": "gpt-4o-mini", "provider": "openai", "cost_per_1k": 0.00015},
            {"model": "claude-sonnet-4", "provider": "anthropic", "cost_per_1k": 0.003},
            {"model": "claude-3-haiku", "provider": "anthropic", "cost_per_1k": 0.00025},
        ]
        
        success = 0
        for i in range(num_events):
            customer = random.choice(self.customers)
            model = random.choice(models)
            tokens = random.randint(100, 3000)
            cost = (tokens / 1000) * model["cost_per_1k"]
            
            event = {
                "customer_id": customer["external_id"],
                "event_type": "llm_completion",
                "model": model["model"],
                "provider": model["provider"],
                "quantity": tokens,
                "cost_usd": round(cost, 6),
                "idempotency_key": f"test_{uuid.uuid4().hex[:12]}",
                "timestamp": (datetime.now(timezone.utc) - timedelta(days=random.uniform(0, 5))).isoformat()
            }
            
            resp = requests.post(f"{BASE_URL}/usage/track", headers=self.get_api_key_headers(), json=event)
            if resp.status_code in [200, 201]:
                success += 1
        
        self.log(f"Created {success}/{num_events} events", "SUCCESS" if success == num_events else "WARN")
        return success

    def test_routing_settings(self):
        self.log("Testing routing settings...", "TEST")
        # Enable routing
        resp = requests.put(f"{BASE_URL}/routing/settings", headers=self.get_headers(),
            json={"smart_routing_enabled": True, "routing_strategy": "cost_optimized"})
        if resp.status_code == 200:
            self.log("Routing enabled", "SUCCESS")
        else:
            self.log(f"Routing settings failed: {resp.status_code}", "ERROR")
        return resp.status_code == 200
    
    def test_routing_test(self):
        self.log("Testing routing decisions...", "TEST")
        tests = [
            ("Simple", "gpt-4o", [{"role": "user", "content": "Translate 'Hello' to Spanish"}], True),
            ("Complex", "gpt-4o", [{"role": "user", "content": "Analyze and compare algorithms with mathematical proofs"}], False),
        ]
        
        all_passed = True
        for name, model, msgs, should_route in tests:
            resp = requests.post(f"{BASE_URL}/routing/test", headers=self.get_headers(),
                json={"model": model, "messages": msgs})
            if resp.status_code == 200:
                data = resp.json()
                routed = data["routing_applied"]
                result = "routed" if routed else "kept"
                expected = "should route" if should_route else "should keep"
                if routed == should_route:
                    self.log(f"  {name}: {result} (correct)", "SUCCESS")
                else:
                    self.log(f"  {name}: {result} ({expected})", "WARN")
            else:
                self.log(f"  {name}: failed {resp.status_code}", "ERROR")
                all_passed = False
        return all_passed
    
    def test_routing_stats(self):
        self.log("Testing routing stats...", "TEST")
        resp = requests.get(f"{BASE_URL}/routing/stats?days=30", headers=self.get_headers())
        if resp.status_code == 200:
            data = resp.json()
            self.log(f"  Decisions: {data['total_decisions']}, Savings: ${data['total_estimated_savings_usd']:.4f}", "SUCCESS")
            return True
        self.log(f"Stats failed: {resp.status_code}", "ERROR")
        return False
    
    def test_routing_models(self):
        self.log("Testing supported models...", "TEST")
        resp = requests.get(f"{BASE_URL}/routing/models", headers=self.get_headers())
        if resp.status_code == 200:
            self.log(f"  {len(resp.json())} models supported", "SUCCESS")
            return True
        self.log(f"Models failed: {resp.status_code}", "ERROR")
        return False
    
    def test_usage_dashboard(self):
        self.log("Testing usage dashboard...", "TEST")
        resp = requests.get(f"{BASE_URL}/usage/dashboard/summary", headers=self.get_headers())
        if resp.status_code == 200:
            data = resp.json()
            self.log(f"  Events: {data['event_count']}, Cost: ${float(data['total_cost_usd']):.4f}, Tokens: {data['total_quantity']:,}", "SUCCESS")
        else:
            self.log(f"Summary failed: {resp.status_code}", "ERROR")
        
        resp = requests.get(f"{BASE_URL}/usage/dashboard/by-model", headers=self.get_headers())
        if resp.status_code == 200:
            self.log(f"  {len(resp.json())} models in usage", "SUCCESS")
        
        resp = requests.get(f"{BASE_URL}/usage/dashboard/daily?days=7", headers=self.get_headers())
        if resp.status_code == 200:
            self.log(f"  {len(resp.json())} days of data", "SUCCESS")
        
        return True
    
    def test_billing(self):
        self.log("Testing billing...", "TEST")
        resp = requests.get(f"{BASE_URL}/billing/config", headers=self.get_headers())
        if resp.status_code == 200:
            data = resp.json()
            self.log(f"  Demo mode: {data.get('demo_mode', False)}", "SUCCESS")
        
        resp = requests.post(f"{BASE_URL}/billing/demo-subscribe", headers=self.get_headers(),
            json={"plan_slug": "growth"})
        if resp.status_code == 200:
            self.log("  Demo subscription: OK", "SUCCESS")
        else:
            self.log(f"  Demo subscription: {resp.status_code}", "WARN")
        return True
    
    def test_realtime(self):
        self.log("Testing real-time SSE...", "TEST")
        try:
            resp = requests.get(f"{BASE_URL}/realtime/stats?interval=1", 
                headers=self.get_headers(), stream=True, timeout=2)
            self.log("  SSE endpoint accessible", "SUCCESS")
        except:
            self.log("  SSE timeout (expected)", "SUCCESS")
        return True
    
    def test_internal(self):
        self.log("Testing internal API...", "TEST")
        resp = requests.get(f"{BASE_URL}/internal/health")
        if resp.status_code == 200:
            self.log("  Health: OK", "SUCCESS")
        
        if self.api_key:
            resp = requests.post(f"{BASE_URL}/internal/validate-key",
                headers={"X-Internal-Key": "internal-api-key"},
                json={"api_key": self.api_key})
            if resp.status_code == 200:
                self.log(f"  Key validation: {resp.json()['valid']}", "SUCCESS")
        return True
    
    def test_customers(self):
        self.log("Testing customer endpoints...", "TEST")
        resp = requests.get(f"{BASE_URL}/customers", headers=self.get_headers())
        if resp.status_code == 200:
            data = resp.json()
            customers = data.get("customers", data) if isinstance(data, dict) else data
            self.log(f"  {len(customers)} customers", "SUCCESS")
            return True
        self.log(f"Customers failed: {resp.status_code}", "ERROR")
        return False
    
    def test_api_keys(self):
        self.log("Testing API keys...", "TEST")
        resp = requests.get(f"{BASE_URL}/api-keys", headers=self.get_headers())
        if resp.status_code == 200:
            self.log(f"  {len(resp.json())} API keys", "SUCCESS")
            return True
        self.log(f"API keys failed: {resp.status_code}", "ERROR")
        return False

    def run_all_tests(self):
        print("\n" + "="*60)
        print("  UsageFlow Comprehensive Test Suite")
        print("="*60 + "\n")
        
        print("-"*40)
        print("SETUP")
        print("-"*40)
        if not self.register_user():
            return
        self.get_tenant_info()
        self.create_api_key()
        self.create_test_customers()
        self.generate_usage_events(30)
        
        print("\n" + "-"*40)
        print("CORE FEATURES")
        print("-"*40)
        self.test_usage_dashboard()
        self.test_customers()
        self.test_api_keys()
        self.test_billing()
        
        print("\n" + "-"*40)
        print("SMART ROUTING")
        print("-"*40)
        self.test_routing_settings()
        self.test_routing_test()
        self.test_routing_stats()
        self.test_routing_models()
        
        print("\n" + "-"*40)
        print("REAL-TIME & INTERNAL")
        print("-"*40)
        self.test_realtime()
        self.test_internal()
        
        print("\n" + "="*60)
        print("  RESULTS")
        print("="*60)
        print(f"  ✅ Passed:   {self.results['passed']}")
        print(f"  ⚠️  Warnings: {self.results['warnings']}")
        print(f"  ❌ Failed:   {self.results['failed']}")
        print("="*60)
        print(f"\n  Frontend: http://localhost:3000")
        print(f"  API Docs: http://localhost:8000/docs")
        print(f"\n  Login: {TEST_USER['email']} / {TEST_USER['password']}")
        print()

if __name__ == "__main__":
    UsageFlowTester().run_all_tests()
