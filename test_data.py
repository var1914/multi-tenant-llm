#!/usr/bin/env python3
"""
Comprehensive test data generator and functionality tester for UsageFlow.
"""

import requests
import json
import random
from datetime import datetime, timedelta
from decimal import Decimal
import uuid

BASE_URL = "http://localhost:8000/api/v1"

# Test user credentials
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
        
    def log(self, message, status="INFO"):
        symbols = {"INFO": "ℹ️", "SUCCESS": "✅", "ERROR": "❌", "TEST": "🧪"}
        print(f"{symbols.get(status, '•')} {message}")
    
    def register_user(self):
        """Register a new test user"""
        self.log("Registering test user...", "TEST")
        response = requests.post(f"{BASE_URL}/auth/register", json=TEST_USER)
        if response.status_code == 200:
            self.log(f"User registered: {TEST_USER['email']}", "SUCCESS")
            return True
        elif response.status_code == 400 and "already registered" in response.text.lower():
            self.log("User already exists, proceeding to login", "INFO")
            return True
        else:
            self.log(f"Registration failed: {response.text}", "ERROR")
            return False
    
    def login(self):
        """Login and get JWT token"""
        self.log("Logging in...", "TEST")
        response = requests.post(
            f"{BASE_URL}/auth/login",
            data={"username": TEST_USER["email"], "password": TEST_USER["password"]}
        )
        if response.status_code == 200:
            data = response.json()
            self.token = data["access_token"]
            self.log(f"Login successful, token obtained", "SUCCESS")
            return True
        else:
            self.log(f"Login failed: {response.text}", "ERROR")
            return False
    
    def get_headers(self):
        return {"Authorization": f"Bearer {self.token}"}
    
    def get_tenant_info(self):
        """Get current tenant information"""
        self.log("Getting tenant info...", "TEST")
        response = requests.get(f"{BASE_URL}/tenants/current", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.tenant_id = data["id"]
            self.log(f"Tenant: {data['company_name']} (ID: {self.tenant_id})", "SUCCESS")
            return data
        else:
            self.log(f"Failed to get tenant: {response.text}", "ERROR")
            return None
    
    def create_api_key(self):
        """Create an API key for testing"""
        self.log("Creating API key...", "TEST")
        response = requests.post(
            f"{BASE_URL}/api-keys",
            headers=self.get_headers(),
            json={"name": "Test API Key", "environment": "test"}
        )
        if response.status_code == 200:
            data = response.json()
            self.api_key = data.get("key") or data.get("api_key")
            self.log(f"API Key created: {self.api_key[:20]}...", "SUCCESS")
            return self.api_key
        else:
            self.log(f"Failed to create API key: {response.text}", "ERROR")
            return None
    
    def create_test_customers(self):
        """Create diverse test customers"""
        self.log("Creating test customers...", "TEST")
        
        customer_profiles = [
            {"external_id": "cust_enterprise_001", "name": "Acme Enterprise", "email": "billing@acme.com", "budget_limit_usd": 5000},
            {"external_id": "cust_startup_002", "name": "TechStartup Inc", "email": "dev@techstartup.io", "budget_limit_usd": 500},
            {"external_id": "cust_smb_003", "name": "Local Business LLC", "email": "owner@localbiz.com", "budget_limit_usd": 200},
            {"external_id": "cust_dev_004", "name": "Indie Developer", "email": "indie@gmail.com", "budget_limit_usd": 50},
            {"external_id": "cust_agency_005", "name": "Digital Agency Co", "email": "api@digitalagency.com", "budget_limit_usd": 2000},
        ]
        
        for profile in customer_profiles:
            response = requests.post(
                f"{BASE_URL}/customers",
                headers=self.get_headers(),
                json=profile
            )
            if response.status_code == 200:
                data = response.json()
                self.customers.append(data)
                self.log(f"  Created customer: {profile['name']}", "SUCCESS")
            elif response.status_code == 400 and "already exists" in response.text.lower():
                self.log(f"  Customer exists: {profile['name']}", "INFO")
                # Fetch existing customer
                resp = requests.get(f"{BASE_URL}/customers", headers=self.get_headers())
                if resp.status_code == 200:
                    for c in resp.json().get("customers", []):
                        if c["external_id"] == profile["external_id"]:
                            self.customers.append(c)
                            break
            else:
                self.log(f"  Failed to create {profile['name']}: {response.text}", "ERROR")
        
        self.log(f"Total customers: {len(self.customers)}", "SUCCESS")
        return self.customers
    
    def generate_usage_events(self, num_events=50):
        """Generate realistic usage events"""
        self.log(f"Generating {num_events} usage events...", "TEST")
        
        models = [
            {"model": "gpt-4o", "provider": "openai", "cost_per_1k": 0.01},
            {"model": "gpt-4o-mini", "provider": "openai", "cost_per_1k": 0.00015},
            {"model": "gpt-3.5-turbo", "provider": "openai", "cost_per_1k": 0.0005},
            {"model": "claude-sonnet-4", "provider": "anthropic", "cost_per_1k": 0.003},
            {"model": "claude-3-haiku", "provider": "anthropic", "cost_per_1k": 0.00025},
        ]
        
        success_count = 0
        for i in range(num_events):
            if not self.customers:
                self.log("No customers available", "ERROR")
                break
                
            customer = random.choice(self.customers)
            model_info = random.choice(models)
            
            # Generate realistic token counts
            input_tokens = random.randint(50, 2000)
            output_tokens = random.randint(100, 3000)
            total_tokens = input_tokens + output_tokens
            
            # Calculate cost
            cost = (total_tokens / 1000) * model_info["cost_per_1k"]
            
            # Random timestamp in last 7 days
            days_ago = random.uniform(0, 7)
            timestamp = (datetime.utcnow() - timedelta(days=days_ago)).isoformat()
            
            event = {
                "customer_id": customer["external_id"],
                "event_type": "llm_completion",
                "model": model_info["model"],
                "provider": model_info["provider"],
                "quantity": total_tokens,
                "cost_usd": round(cost, 6),
                "metadata": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "source": "test_generator"
                },
                "idempotency_key": f"test_event_{uuid.uuid4().hex[:8]}",
                "timestamp": timestamp
            }
            
            response = requests.post(
                f"{BASE_URL}/usage/track",
                headers=self.get_headers(),
                json=event
            )
            
            if response.status_code == 200:
                success_count += 1
            else:
                self.log(f"  Event {i+1} failed: {response.text}", "ERROR")
        
        self.log(f"Created {success_count}/{num_events} usage events", "SUCCESS")
        return success_count

    def test_routing_settings(self):
        """Test smart routing settings endpoints"""
        self.log("Testing Smart Routing settings...", "TEST")
        
        # Get current settings
        response = requests.get(f"{BASE_URL}/routing/settings", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Current settings: enabled={data['smart_routing_enabled']}, strategy={data['routing_strategy']}", "SUCCESS")
        else:
            self.log(f"  Failed to get settings: {response.text}", "ERROR")
            return False
        
        # Enable routing
        response = requests.put(
            f"{BASE_URL}/routing/settings",
            headers=self.get_headers(),
            json={"smart_routing_enabled": True, "routing_strategy": "cost_optimized"}
        )
        if response.status_code == 200:
            self.log("  Enabled smart routing with cost_optimized strategy", "SUCCESS")
        else:
            self.log(f"  Failed to update settings: {response.text}", "ERROR")
            return False
        
        return True
    
    def test_routing_test_endpoint(self):
        """Test the routing test endpoint"""
        self.log("Testing routing test endpoint...", "TEST")
        
        test_cases = [
            {
                "name": "Simple task",
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "Translate 'Hello' to Spanish"}]
            },
            {
                "name": "Complex task",
                "model": "gpt-4o",
                "messages": [{"role": "user", "content": "Analyze the following code and provide a detailed step-by-step explanation of the algorithm, comparing its time complexity with alternative approaches and suggesting optimizations: def quicksort(arr): ..."}]
            },
            {
                "name": "Code review",
                "model": "claude-sonnet-4",
                "messages": [{"role": "user", "content": "Please review this Python code for security vulnerabilities, performance issues, and suggest refactoring improvements with detailed reasoning for each suggestion."}]
            }
        ]
        
        for tc in test_cases:
            response = requests.post(
                f"{BASE_URL}/routing/test",
                headers=self.get_headers(),
                json={"model": tc["model"], "messages": tc["messages"]}
            )
            if response.status_code == 200:
                data = response.json()
                routed = "ROUTED" if data["routing_applied"] else "KEPT"
                self.log(f"  {tc['name']}: {routed} ({tc['model']} -> {data['routed_model']}, complexity: {data.get('complexity_score', 'N/A')})", "SUCCESS")
            else:
                self.log(f"  {tc['name']} failed: {response.text}", "ERROR")
        
        return True
    
    def test_routing_stats(self):
        """Test routing statistics endpoint"""
        self.log("Testing routing stats...", "TEST")
        response = requests.get(f"{BASE_URL}/routing/stats?days=30", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Total decisions: {data['total_decisions']}", "SUCCESS")
            self.log(f"  Routing rate: {data['routing_rate']:.1f}%", "SUCCESS")
            self.log(f"  Estimated savings: ${data['total_estimated_savings_usd']:.4f}", "SUCCESS")
            return True
        else:
            self.log(f"  Failed: {response.text}", "ERROR")
            return False
    
    def test_routing_models(self):
        """Test supported models endpoint"""
        self.log("Testing supported models endpoint...", "TEST")
        response = requests.get(f"{BASE_URL}/routing/models", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Found {len(data)} supported models", "SUCCESS")
            for m in data[:3]:
                self.log(f"    - {m['model']} ({m['provider']}/{m['tier']}): ${m['input_cost_per_1m']}/1M input", "INFO")
            return True
        else:
            self.log(f"  Failed: {response.text}", "ERROR")
            return False
    
    def test_usage_dashboard(self):
        """Test usage dashboard endpoints"""
        self.log("Testing usage dashboard...", "TEST")
        
        # Summary
        response = requests.get(f"{BASE_URL}/usage/dashboard/summary", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Total cost: ${data.get('total_cost', 0):.4f}", "SUCCESS")
            self.log(f"  Total tokens: {data.get('total_tokens', 0):,}", "SUCCESS")
            self.log(f"  Total events: {data.get('total_events', 0):,}", "SUCCESS")
        else:
            self.log(f"  Summary failed: {response.text}", "ERROR")
        
        # Daily breakdown
        response = requests.get(f"{BASE_URL}/usage/dashboard/daily?days=7", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Daily data points: {len(data)}", "SUCCESS")
        else:
            self.log(f"  Daily failed: {response.text}", "ERROR")
        
        return True
    
    def test_billing_config(self):
        """Test billing configuration"""
        self.log("Testing billing configuration...", "TEST")
        response = requests.get(f"{BASE_URL}/billing/config", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            demo_mode = data.get("demo_mode", False)
            self.log(f"  Demo mode: {demo_mode}", "SUCCESS")
            self.log(f"  Plans available: {len(data.get('plans', []))}", "SUCCESS")
            return True
        else:
            self.log(f"  Failed: {response.text}", "ERROR")
            return False
    
    def test_demo_subscribe(self):
        """Test demo subscription"""
        self.log("Testing demo subscription...", "TEST")
        response = requests.post(
            f"{BASE_URL}/billing/demo-subscribe",
            headers=self.get_headers(),
            json={"plan_slug": "growth"}
        )
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Subscribed to: {data.get('plan', 'unknown')}", "SUCCESS")
            return True
        else:
            self.log(f"  Failed: {response.text}", "ERROR")
            return False
    
    def test_alerts(self):
        """Test alerts endpoints"""
        self.log("Testing alerts...", "TEST")
        
        # Create alert
        alert_data = {
            "name": "High Usage Alert",
            "alert_type": "usage_threshold",
            "threshold_value": 1000,
            "threshold_unit": "tokens",
            "notification_channels": ["email"]
        }
        response = requests.post(
            f"{BASE_URL}/alerts",
            headers=self.get_headers(),
            json=alert_data
        )
        if response.status_code == 200:
            self.log("  Created usage alert", "SUCCESS")
        else:
            self.log(f"  Alert creation: {response.status_code} - may already exist", "INFO")
        
        # List alerts
        response = requests.get(f"{BASE_URL}/alerts", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            self.log(f"  Total alerts: {len(data.get('alerts', data) if isinstance(data, dict) else data)}", "SUCCESS")
        else:
            self.log(f"  List alerts failed: {response.text}", "ERROR")
        
        return True
    
    def test_customers_list(self):
        """Test customer listing with usage data"""
        self.log("Testing customers with usage...", "TEST")
        response = requests.get(f"{BASE_URL}/customers", headers=self.get_headers())
        if response.status_code == 200:
            data = response.json()
            customers = data.get("customers", data) if isinstance(data, dict) else data
            self.log(f"  Total customers: {len(customers)}", "SUCCESS")
            for c in customers[:3]:
                name = c.get("name", c.get("external_id", "Unknown"))
                self.log(f"    - {name}", "INFO")
            return True
        else:
            self.log(f"  Failed: {response.text}", "ERROR")
            return False
    
    def test_internal_api(self):
        """Test internal API endpoints"""
        self.log("Testing internal API...", "TEST")
        
        # Health check
        response = requests.get(f"{BASE_URL}/internal/health")
        if response.status_code == 200:
            self.log("  Health check: OK", "SUCCESS")
        else:
            self.log(f"  Health check failed: {response.text}", "ERROR")
        
        # Validate key (requires internal key)
        internal_key = "internal-api-key"
        if self.api_key:
            response = requests.post(
                f"{BASE_URL}/internal/validate-key",
                headers={"X-Internal-Key": internal_key},
                json={"api_key": self.api_key}
            )
            if response.status_code == 200:
                data = response.json()
                self.log(f"  Key validation: valid={data['valid']}", "SUCCESS")
            else:
                self.log(f"  Key validation failed: {response.text}", "ERROR")
        
        return True

    def run_all_tests(self):
        """Run all tests in sequence"""
        print("\n" + "="*60)
        print("🚀 UsageFlow Comprehensive Test Suite")
        print("="*60 + "\n")
        
        # Setup
        if not self.register_user():
            return
        if not self.login():
            return
        self.get_tenant_info()
        self.create_api_key()
        self.create_test_customers()
        
        print("\n" + "-"*40)
        print("📊 Generating Test Data")
        print("-"*40)
        self.generate_usage_events(50)
        
        print("\n" + "-"*40)
        print("🧪 Testing API Endpoints")
        print("-"*40)
        
        self.test_usage_dashboard()
        self.test_customers_list()
        self.test_billing_config()
        self.test_demo_subscribe()
        self.test_alerts()
        self.test_routing_settings()
        self.test_routing_test_endpoint()
        self.test_routing_stats()
        self.test_routing_models()
        self.test_internal_api()
        
        print("\n" + "="*60)
        print("✅ Test Suite Complete!")
        print("="*60)
        print(f"\nLogin credentials for frontend testing:")
        print(f"  Email: {TEST_USER['email']}")
        print(f"  Password: {TEST_USER['password']}")
        print(f"\nFrontend URL: http://localhost:3000")
        print(f"API Docs: http://localhost:8000/docs")


if __name__ == "__main__":
    tester = UsageFlowTester()
    tester.run_all_tests()
