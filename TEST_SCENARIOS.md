# TokenTrail - Real User Test Scenarios

**Test Date:** January 22, 2026
**Environment:** https://tokentrailapp.com
**Tester:** Manual testing as actual user

---

## Pre-requisites

- [ ] OpenAI API key ready (get from https://platform.openai.com/api-keys)
- [ ] Anthropic API key ready (get from https://console.anthropic.com/)
- [ ] Provider keys configured in backend environment

---

## Scenario 1: Account & Authentication

### 1.1 Registration
- [ ] Go to https://tokentrailapp.com
- [ ] Click "Sign Up" / "Get Started"
- [ ] Fill registration form (email, password, company name)
- [ ] Submit and verify redirect to dashboard
- [ ] **Expected:** Dashboard loads with welcome message

### 1.2 Login/Logout
- [ ] Click "Sign Out"
- [ ] Log back in with credentials
- [ ] **Expected:** Successful login, session persists

**Notes:**
```
Email used:
Issues found:
```

---

## Scenario 2: Customer Management

### 2.1 Create a Customer
- [ ] Navigate to **Customers** page
- [ ] Click "Add Customer" button
- [ ] Fill in:
  - External ID: `test-customer-001`
  - Name: `Test Company Alpha`
  - Email: `alpha@test.com`
- [ ] Set budget limit: `$5.00`
- [ ] Enable "Block on limit"
- [ ] Save customer
- [ ] **Expected:** Customer appears in list

### 2.2 Create Second Customer (for comparison)
- [ ] Add another customer:
  - External ID: `test-customer-002`
  - Name: `Test Company Beta`
  - Budget: `$10.00`
- [ ] **Expected:** Two customers visible

**Notes:**
```
Customer IDs created:
Issues found:
```

---

## Scenario 3: API Key Management

### 3.1 Generate API Key
- [ ] Navigate to **API Keys** page
- [ ] Click "Create API Key"
- [ ] Name: `Test Key - Alpha`
- [ ] Select environment: Live
- [ ] Create and **COPY THE KEY** (shown only once)
- [ ] **Expected:** Key starts with `tt_live_`

### 3.2 Store the API Key
```
API Key: tt_live_________________________________
```

**Notes:**
```
Issues found:
```

---

## Scenario 4: Make LLM Calls (Real Usage)

### 4.1 Simple GPT-3.5 Call
Run this in terminal (replace YOUR_API_KEY):

```bash
curl https://tokentrailapp.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Customer-ID: test-customer-001" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Say hello in 5 words"}],
    "max_tokens": 20
  }'
```

- [ ] Request succeeds
- [ ] Response contains completion
- [ ] **Expected cost:** ~$0.0001

### 4.2 GPT-4o Call (Higher Cost)
```bash
curl https://tokentrailapp.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Customer-ID: test-customer-001" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Explain REST API in 2 sentences"}],
    "max_tokens": 100
  }'
```

- [ ] Request succeeds
- [ ] **Expected cost:** ~$0.005

### 4.3 Claude Call
```bash
curl https://tokentrailapp.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Customer-ID: test-customer-002" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [{"role": "user", "content": "What is TypeScript?"}],
    "max_tokens": 100
  }'
```

- [ ] Request succeeds (if Anthropic key configured)
- [ ] **Expected cost:** ~$0.01

**Notes:**
```
Successful calls:
Failed calls:
Error messages:
```

---

## Scenario 5: Dashboard & Analytics Verification

### 5.1 Check Dashboard
- [ ] Navigate to **Dashboard**
- [ ] Verify "Total Cost" reflects the calls made
- [ ] Verify "Total Usage" shows token count
- [ ] Verify customer count shows 2
- [ ] **Expected:** Live data matches API calls

### 5.2 Check Analytics
- [ ] Navigate to **Analytics**
- [ ] Verify charts show usage data
- [ ] Check cost breakdown by model
- [ ] Check cost breakdown by customer
- [ ] **Expected:** Data visible in charts

**Notes:**
```
Total cost shown: $
Total tokens shown:
Issues found:
```

---

## Scenario 6: Smart Routing Test

### 6.1 Enable Smart Routing
- [ ] Navigate to **Smart Routing**
- [ ] Enable smart routing toggle
- [ ] Set routing strategy (cost optimization)
- [ ] Save settings

### 6.2 Test Routing Decision
```bash
# Request GPT-4 for a simple task - should route to cheaper model
curl https://tokentrailapp.com/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Customer-ID: test-customer-001" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "What is 2+2?"}],
    "max_tokens": 10
  }'
```

- [ ] Check response model - was it routed?
- [ ] Check routing decisions in UI
- [ ] **Expected:** Simple query routes to cheaper model

**Notes:**
```
Routing applied: Yes/No
Original model:
Routed to:
Savings: $
```

---

## Scenario 7: Budget Limit Test

### 7.1 Approach Budget Limit
Make multiple calls to test-customer-001 (budget: $5):

```bash
# Make 5-10 calls to accumulate cost
for i in {1..5}; do
  curl https://tokentrailapp.com/v1/chat/completions \
    -H "Authorization: Bearer YOUR_API_KEY" \
    -H "Content-Type: application/json" \
    -H "X-Customer-ID: test-customer-001" \
    -d '{
      "model": "gpt-4o",
      "messages": [{"role": "user", "content": "Write a paragraph about AI"}],
      "max_tokens": 200
    }'
  sleep 1
done
```

### 7.2 Check Budget Status
- [ ] Go to **Customers** page
- [ ] Check test-customer-001 budget usage
- [ ] **Expected:** Shows % of budget used

### 7.3 Exceed Budget (if close)
- [ ] Make more calls until budget exceeded
- [ ] **Expected:** Request blocked with budget error
- [ ] Error message indicates budget limit reached

**Notes:**
```
Budget limit: $5.00
Current spend: $
Blocked at: $
Error message:
```

---

## Scenario 8: Predictions & Alerts

### 8.1 Check Predictions
- [ ] Navigate to **Predictions**
- [ ] View cost forecast
- [ ] Check predicted end-of-month cost
- [ ] **Expected:** Forecast based on current usage pattern

### 8.2 Set Up Alert
- [ ] Create budget alert for a customer
- [ ] Set threshold (e.g., 80%)
- [ ] **Expected:** Alert configuration saved

**Notes:**
```
Predicted monthly cost: $
Alerts configured:
```

---

## Scenario 9: Workflows (Agent Tracking)

### 9.1 View Workflows
- [ ] Navigate to **Workflows**
- [ ] Check if any workflow traces appear
- [ ] **Expected:** Shows agent/workflow activity if any

**Notes:**
```
Workflows visible:
```

---

## Scenario 10: Billing

### 10.1 Check Billing Page
- [ ] Navigate to **Billing**
- [ ] View current plan
- [ ] View usage summary
- [ ] **Expected:** Billing information displayed

**Notes:**
```
Current plan:
```

---

## Scenario 11: Settings

### 11.1 Profile Settings
- [ ] Navigate to **Settings**
- [ ] View/update profile info
- [ ] Check company settings
- [ ] **Expected:** Settings editable

---

## Test Summary

| Scenario | Status | Notes |
|----------|--------|-------|
| 1. Auth | | |
| 2. Customers | | |
| 3. API Keys | | |
| 4. LLM Calls | | |
| 5. Dashboard | | |
| 6. Smart Routing | | |
| 7. Budget Limits | | |
| 8. Predictions | | |
| 9. Workflows | | |
| 10. Billing | | |
| 11. Settings | | |

**Total Estimated Cost:** $1-5 for all tests

---

## Issues Found

| # | Scenario | Issue | Severity | Fixed |
|---|----------|-------|----------|-------|
| 1 | | | | |
| 2 | | | | |
| 3 | | | | |

