# Customer Tracking

Track LLM usage per customer to understand costs, set limits, and bill accurately.

## Why Track by Customer?

Without per-customer tracking, you can't:
- Know which customers are profitable
- Bill for AI usage fairly
- Set appropriate budget limits
- Identify heavy users or abuse

TokenTrail makes customer tracking automatic and effortless.

## How It Works

Every LLM request can include a customer identifier:

```javascript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_123'  // ← This tracks the customer
})
```

TokenTrail automatically:
1. Creates the customer if they don't exist
2. Tracks all usage for that customer
3. Calculates total costs
4. Shows breakdowns in the dashboard

## Setting Up Customers

### Automatic Creation

The simplest approach—customers are created automatically on first request:

```javascript
// First request from customer_abc
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{role: 'user', content: 'Hello'}],
  user: 'customer_abc'  // New customer created automatically
})
```

TokenTrail will create `customer_abc` with default settings.

### Manual Creation (Recommended)

For better control, create customers explicitly with budget limits:

```bash
curl -X POST https://api.tokentrailapp.com/v1/customers \
  -H "Authorization: Bearer tt_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "customer_abc",
    "name": "Acme Corporation",
    "email": "billing@acme.com",
    "budget_limit_usd": 100.00,
    "budget_block_on_limit": true,
    "metadata": {
      "tier": "enterprise",
      "plan": "pro"
    }
  }'
```

Now when `customer_abc` makes requests:
- Their usage is tracked
- Costs count toward their $100 budget
- Requests are blocked at limit
- You have their contact info for billing

## Customer Identifiers

### Using External IDs

Use your own customer IDs (from your database):

```javascript
// Your internal customer ID
const customerId = user.id  // "usr_abc123" from your DB

await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: customerId  // Maps to your system
})
```

**Best Practice**: Use stable, unique identifiers:
- ✅ `"customer_abc123"` - Database ID
- ✅ `"org_xyz789"` - Organization ID
- ✅ `"usr_def456"` - User ID
- ❌ `"john@example.com"` - Can change
- ❌ `"session_temp123"` - Temporary

### Multiple Identifiers

Track by different dimensions using metadata:

```javascript
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_abc',  // Primary customer ID
  metadata: {
    organization_id: 'org_xyz',
    team_id: 'team_123',
    feature: 'chat_support',
    environment: 'production'
  }
})
```

Query usage by any dimension in analytics.

## Viewing Customer Usage

### Dashboard

**Customers** page shows real-time usage:

| Customer | Requests | Tokens | Cost | Budget | Status |
|----------|----------|--------|------|--------|--------|
| Acme Corp | 1,247 | 234.5K | $85.23 | $100 | ⚠️ 85% |
| Beta Inc | 532 | 89.2K | $12.45 | $50 | ✅ 25% |
| Gamma LLC | 89 | 15.3K | $2.10 | No limit | - |

Click any customer to see detailed usage over time.

### API Query

Get usage for a specific customer:

```bash
curl "https://api.tokentrailapp.com/v1/customers/customer_abc/usage?period=month" \
  -H "Authorization: Bearer tt_live_..."
```

**Response:**
```json
{
  "customer_id": "customer_abc",
  "customer_name": "Acme Corporation",
  "period": "2024-01",
  "total_requests": 1247,
  "total_tokens": 234567,
  "total_cost_usd": "85.23",
  "breakdown_by_model": [
    {
      "model": "gpt-4",
      "requests": 423,
      "tokens": 123456,
      "cost_usd": "42.12"
    },
    {
      "model": "gpt-3.5-turbo",
      "requests": 824,
      "tokens": 111111,
      "cost_usd": "43.11"
    }
  ],
  "daily_usage": [
    {"date": "2024-01-01", "requests": 45, "cost_usd": "3.21"},
    {"date": "2024-01-02", "requests": 52, "cost_usd": "4.12"},
    ...
  ]
}
```

## Customer Metadata

Store additional information about customers:

```javascript
// Create customer with metadata
await fetch('https://api.tokentrailapp.com/v1/customers', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tt_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    external_id: 'customer_abc',
    name: 'Acme Corp',
    email: 'billing@acme.com',
    metadata: {
      // Custom fields for your use case
      subscription_plan: 'enterprise',
      mrr: 499,
      signup_date: '2024-01-01',
      account_manager: 'sarah@yourcompany.com',
      tags: ['high-value', 'ai-heavy']
    }
  })
})
```

Use metadata for:
- Filtering customers in dashboard
- Grouping usage reports
- Custom billing logic
- Analytics segmentation

## Usage Analytics

### By Customer

See which customers use the most:

**Top Customers by Cost (This Month)**

| Customer | Cost | Change | Trend |
|----------|------|--------|-------|
| Acme Corp | $1,234 | +23% | 📈 |
| Beta Inc | $892 | -5% | 📉 |
| Gamma LLC | $567 | +8% | 📈 |

### By Feature

Track usage across features per customer:

```javascript
// Tag requests by feature
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_abc',
  metadata: {
    feature: 'code_completion'  // or 'chat', 'summarize', etc.
  }
})
```

**Customer ABC Usage by Feature:**

| Feature | Requests | Cost | % of Total |
|---------|----------|------|-----------|
| Code Completion | 523 | $45.23 | 53% |
| Chat Support | 389 | $28.12 | 33% |
| Summarization | 145 | $12.01 | 14% |

### By Model

See which models each customer uses:

```json
{
  "customer_abc": {
    "gpt-4": "45%",
    "gpt-3.5-turbo": "52%",
    "gpt-4-turbo": "3%"
  }
}
```

## Billing Integration

### Export for Manual Billing

Download CSV for each customer:

```bash
curl "https://api.tokentrailapp.com/v1/customers/customer_abc/export?format=csv&period=month" \
  -H "Authorization: Bearer tt_live_..." \
  -o customer_abc_jan2024.csv
```

**CSV Format:**
```csv
Date,Model,Requests,Tokens,Cost
2024-01-01,gpt-4,45,12345,$1.23
2024-01-01,gpt-3.5-turbo,89,23456,$0.89
...
```

Import into your billing system or send to customer.

### Stripe Integration

Automatically charge customers based on usage:

```javascript
// Set up customer with Stripe ID
await fetch('https://api.tokentrailapp.com/v1/customers/customer_abc', {
  method: 'PATCH',
  headers: {
    'Authorization': 'Bearer tt_live_...',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    metadata: {
      stripe_customer_id: 'cus_abc123'
    }
  })
})
```

TokenTrail can automatically:
1. Calculate monthly usage
2. Create Stripe invoice
3. Charge customer's payment method
4. Send receipt

(See [Billing Integration](./billing.md) for details)

## Customer Grouping

### Organizations

Group customers into organizations:

```javascript
// Create organization
await fetch('https://api.tokentrailapp.com/v1/organizations', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Acme Corporation',
    customers: ['customer_abc', 'customer_def', 'customer_ghi']
  })
})
```

View aggregated usage for entire organization.

### Teams/Departments

Track usage by team within a customer:

```javascript
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_abc',
  metadata: {
    team: 'engineering',
    department: 'product'
  }
})
```

## Customer Limits

### Budget Limits

Set spending limits per customer (see [Budget Limits](./budget-limits.md)):

```json
{
  "customer_id": "customer_abc",
  "budget_limit_usd": 100.00,
  "budget_block_on_limit": true,
  "budget_alert_threshold": 80
}
```

When customer hits 80%, you're alerted.
When they hit 100%, requests are blocked.

### Rate Limits

Limit requests per time period:

```json
{
  "customer_id": "customer_abc",
  "rate_limit": {
    "requests_per_minute": 60,
    "requests_per_day": 5000
  }
}
```

Prevents abuse and controls costs.

## Best Practices

### 1. Always Pass Customer ID

Make it a habit:

```javascript
// ✅ Good - always include user
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: userId  // Never forget this!
})

// ❌ Bad - no customer tracking
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...]
  // Missing user field
})
```

### 2. Use Consistent Identifiers

```javascript
// ✅ Good - use stable DB ID
user: user.id  // "usr_abc123"

// ❌ Bad - email can change
user: user.email  // "john@example.com"
```

### 3. Set Budgets Early

Don't wait for overages:

```javascript
// When customer signs up
await createCustomer({
  external_id: newUser.id,
  budget_limit_usd: getDefaultBudget(newUser.plan),
  budget_block_on_limit: true
})
```

### 4. Monitor Regularly

Review customer usage weekly:
- Identify heavy users
- Adjust limits as needed
- Reach out to customers approaching limits
- Look for unusual patterns (potential abuse)

### 5. Add Context with Metadata

```javascript
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: customerId,
  metadata: {
    feature: 'chat',
    session_id: sessionId,
    user_tier: customer.tier,
    version: 'v2.0'
  }
})
```

Rich metadata enables better analytics.

## Troubleshooting

### Customer not showing in dashboard

**Check**: Are you passing the `user` parameter?
```javascript
user: 'customer_abc'  // ← This is required
```

**Check**: Is the customer ID correct?
```javascript
// Log it to verify
console.log('Tracking customer:', userId)
```

### Usage not attributed correctly

**Check**: Customer ID is consistent across requests
```javascript
// ✅ Always the same
user: user.id  // "usr_123"

// ❌ Changes each request
user: `session_${Date.now()}`  // Different every time
```

### Budget limits not working

**Check**: Customer has budget configured
```bash
curl https://api.tokentrailapp.com/v1/customers/customer_abc \
  -H "Authorization: Bearer tt_live_..."

# Response should include:
# "budget_limit_usd": "100.00",
# "budget_block_on_limit": true
```

## Next Steps

- [Budget Limits](./budget-limits.md) - Set spending controls per customer
- [Analytics](./analytics.md) - Dive deep into usage patterns
- [Billing](./billing.md) - Bill customers for their usage
- [Smart Routing](./smart-routing.md) - Optimize costs per customer
