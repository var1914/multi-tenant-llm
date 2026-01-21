# Budget Limits & Request Blocking

Prevent runaway costs by setting monthly spending limits for your customers. TokenTrail can automatically block requests when budgets are exceeded.

## Why Budget Limits?

Without limits, a single power user or bug can drain your entire LLM budget:

- 🔥 **"A customer ran an infinite loop and burned $5,000 in 2 hours"**
- 💸 **"We had no idea one feature was costing us $12k/month"**
- 🚨 **"A bot attacked our API and maxed out our OpenAI credits"**

Budget limits prevent these scenarios by automatically blocking requests when a customer exceeds their allocated budget.

## How It Works

```
1. Customer makes LLM request
   ↓
2. TokenTrail checks current month's spend
   ↓
3. Compare spend vs budget limit
   ↓
4a. Under limit → Request proceeds
4b. Over limit + blocking enabled → Request blocked with error
4c. Over limit + blocking disabled → Request proceeds + alert sent
```

All checks happen in <3ms before the request reaches the LLM provider.

## Setting Up Budget Limits

### Via Dashboard

1. Go to **Customers** page
2. Click a customer or **Add Customer**
3. Configure budget settings:

   **Monthly Limit (USD)**
   ```
   $100.00
   ```
   Total monthly spending limit for this customer.

   **Alert Threshold (%)**
   ```
   80
   ```
   Send alert when customer hits 80% of their limit.

   **Enable Alerts**
   ```
   [✓] Checked
   ```
   Get notified via email/Slack when threshold is reached.

   **Block Requests When Limit Exceeded**
   ```
   [✓] Checked (recommended)
   [ ] Unchecked (alert only)
   ```
   When checked, requests are automatically rejected after limit is reached.

4. Click **Save**

### Via API

```bash
curl -X POST https://api.tokentrailapp.com/v1/customers \
  -H "Authorization: Bearer tt_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "customer_123",
    "name": "Acme Corp",
    "email": "billing@acme.com",
    "budget_limit_usd": 100.00,
    "budget_alert_threshold": 80,
    "budget_alert_enabled": true,
    "budget_block_on_limit": true
  }'
```

## What Happens When Budget is Exceeded?

### With Blocking Enabled

When a customer exceeds their budget:

1. **Request is rejected** before reaching the LLM provider
2. **Error returned** to your application
3. **Alert sent** to your team (email/Slack)
4. **Customer stays blocked** until next month (resets on day 1)

**Error Response:**
```json
{
  "error": {
    "message": "Budget limit exceeded: Customer 'customer_123' has exceeded their monthly budget limit of $100.00. Current spend: $102.45",
    "type": "budget_limit_exceeded",
    "code": 429
  }
}
```

Your application should handle this gracefully:

```javascript
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
    user: 'customer_123',
  })
} catch (error) {
  if (error.code === 429 && error.type === 'budget_limit_exceeded') {
    // Customer is over budget
    console.log('Customer has exceeded their monthly budget')
    // Show upgrade prompt or "limit reached" message
  }
}
```

### Without Blocking (Alert Only)

When blocking is disabled:

1. **Request proceeds** normally to LLM provider
2. **Alert sent** to your team (email/Slack)
3. **Usage tracked** as usual
4. **No service interruption** for customer

Use this mode if you want visibility without enforcement.

## Budget Alerts

### Alert Thresholds

You get notified at configurable thresholds:

- **80% (default)** - Warning: approaching limit
- **100%** - Critical: limit reached
- **Custom** - Set any percentage (50%, 90%, etc.)

### Alert Channels

Configure where alerts are sent:

**Email** (default)
- Sent to your account email
- Includes customer details and current spend

**Slack** (requires integration)
```
🚨 Budget Alert: customer_123

Customer: Acme Corp
Current Spend: $85.23 / $100.00 (85%)
Status: ⚠️ Approaching limit

View Details: https://app.tokentrailapp.com/customers/customer_123
```

**Webhook** (for custom integrations)
```bash
POST https://your-webhook.com/budget-alert
{
  "customer_id": "customer_123",
  "customer_name": "Acme Corp",
  "budget_limit_usd": "100.00",
  "current_spend_usd": "85.23",
  "percentage_used": 85.23,
  "threshold_reached": 80,
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Monthly Reset

Budgets automatically reset on the 1st day of each month at 00:00 UTC.

**Example Timeline:**
- Jan 1-31: Customer has $100 budget
- Jan 25: Customer hits $100, gets blocked
- Jan 26-31: Customer remains blocked
- Feb 1: Budget resets, customer can make requests again

**Current Spend Calculation:**
```sql
SELECT SUM(cost_usd)
FROM usage_events
WHERE customer_id = 'customer_123'
  AND event_timestamp >= '2024-02-01 00:00:00'
  AND event_timestamp < '2024-03-01 00:00:00'
```

## Monitoring Budget Status

### Dashboard View

The **Customers** page shows real-time budget status:

| Customer | Monthly Budget | Current Spend | Status |
|----------|---------------|---------------|--------|
| Acme Corp | $100.00 🛡️ Blocking | $85.23 | ⚠️ 85% used |
| Beta Inc | $50.00 | $12.45 | ✅ 25% used |
| Gamma LLC | No limit | $234.56 | - |

**Status Indicators:**
- ✅ Green: Under 80%
- ⚠️ Yellow: 80-99%
- 🔴 Red: 100%+ (blocked if enabled)
- 🛡️ Shield: Blocking enabled

### API Check

Check a customer's budget status programmatically:

```bash
curl https://api.tokentrailapp.com/v1/customers/customer_123/budget-status \
  -H "Authorization: Bearer tt_live_..."
```

**Response:**
```json
{
  "customer_id": "customer_123",
  "customer_name": "Acme Corp",
  "budget_limit_usd": "100.00",
  "budget_block_on_limit": true,
  "current_spend_usd": "85.23",
  "percentage_used": 85.23,
  "is_over_budget": false,
  "is_near_threshold": true,
  "is_blocked": false
}
```

## Best Practices

### 1. Start with Alerts Only

Before enabling blocking, test with alerts:

```javascript
budget_block_on_limit: false  // Alert only
budget_alert_threshold: 80    // Warn at 80%
```

This gives you visibility without risking service disruption.

### 2. Set Conservative Limits

Start lower than you think:

❌ **Too high**: `$1000/month` (won't catch runaway costs)
✅ **Better**: `$100/month` (catches issues early)

You can always increase limits based on actual usage.

### 3. Communicate with Customers

If you're blocking customer requests:

```javascript
// Show friendly message to users
if (error.type === 'budget_limit_exceeded') {
  showUpgradePrompt({
    title: "You've reached your AI usage limit",
    message: "Upgrade to continue using AI features",
    cta: "Upgrade Plan"
  })
}
```

### 4. Monitor Frequently

Check budget status daily during early rollout:

- Review customers approaching limits
- Adjust limits based on patterns
- Investigate unusual spikes

### 5. Combine with Usage Analysis

Budget limits work best with analytics:

1. **Track** usage patterns first
2. **Set** appropriate limits based on data
3. **Block** only when necessary
4. **Adjust** limits as usage evolves

## Common Questions

### What if I need to increase a limit mid-month?

Just update the customer's budget limit—changes apply immediately:

```bash
curl -X PATCH https://api.tokentrailapp.com/v1/customers/customer_123 \
  -H "Authorization: Bearer tt_live_..." \
  -d '{"budget_limit_usd": 200.00}'
```

### Can I set different limits for different time periods?

Currently, budgets are monthly only. For custom billing periods, use the API to:
1. Query usage for your desired period
2. Implement custom limits in your application
3. Use TokenTrail's blocking as a safety net

### What happens if TokenTrail's budget check fails?

**Fail open**: If the budget check times out or errors, the request proceeds to prevent service disruption. You'll see an error in logs and can investigate.

### Can I get a warning before the limit is hit?

Yes! Set `budget_alert_threshold` to any percentage:
- 50% = early warning
- 80% = standard warning (default)
- 95% = last-minute warning

## Next Steps

- [Smart Routing](./smart-routing.md) - Reduce costs with automatic model routing
- [Customer Tracking](./customer-tracking.md) - Understand per-customer usage
- [Analytics](./analytics.md) - Visualize spending patterns
- [Billing](./billing.md) - Bill customers for their AI usage
