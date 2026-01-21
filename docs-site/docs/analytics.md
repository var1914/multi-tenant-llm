# Analytics & Reporting

Understand your LLM usage patterns, identify cost drivers, and optimize spending with comprehensive analytics.

## Dashboard Overview

The main dashboard shows real-time metrics:

### Key Metrics

**Current Month**
- **Total Requests**: 12,459
- **Total Tokens**: 2.8M
- **Total Cost**: $1,234.56
- **Avg Cost/Request**: $0.099

**Trends**
- Requests: +15% vs last month
- Cost: +8% vs last month
- Savings from routing: $523.12 (42%)

## Usage Analytics

### By Time Period

View usage over different time ranges:

- **Real-time** - Last 24 hours with 1-hour granularity
- **Daily** - Last 30 days
- **Monthly** - Last 12 months
- **Custom** - Any date range

**Example: Daily Usage (Last 30 Days)**

```
Tokens (thousands)
100 ┤              ╭╮
 80 ┤         ╭╮  ╭╯╰╮
 60 ┤    ╭╮  ╭╯╰─╯   ╰╮
 40 ┤╭─╮╭╯╰─╯         ╰─╮
 20 ┤╯ ╰╯                ╰
  0 ┴─────────────────────
    1  5  10  15  20  25  30
```

### By Model

See which models you're using:

| Model | Requests | Tokens | Cost | % of Total |
|-------|----------|--------|------|-----------|
| gpt-3.5-turbo | 8,234 | 1.2M | $345.67 | 28% |
| gpt-4 | 3,425 | 890K | $678.90 | 55% |
| gpt-4-turbo | 800 | 210K | $210.00 | 17% |

### By Customer

Top customers by usage and cost:

| Customer | Requests | Cost | Trend |
|----------|----------|------|-------|
| Acme Corp | 5,234 | $567.89 | 📈 +12% |
| Beta Inc | 3,456 | $234.56 | 📉 -5% |
| Gamma LLC | 2,123 | $123.45 | → 0% |

### By Feature

Track usage by application feature:

```javascript
// Tag requests by feature
await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  metadata: { feature: 'code_completion' }
})
```

**Usage by Feature**

| Feature | Requests | Cost | % Total |
|---------|----------|------|---------|
| Code Completion | 4,567 | $456.78 | 37% |
| Chat Support | 3,890 | $389.12 | 31% |
| Summarization | 2,345 | $234.56 | 19% |
| Other | 1,657 | $154.10 | 13% |

## Cost Analytics

### Cost Breakdown

Understand where money goes:

**By Model**
```
GPT-4:        $678.90 (55%) ████████████████████
GPT-3.5:      $345.67 (28%) ██████████
GPT-4-Turbo:  $210.00 (17%) ██████
```

**By Customer**
```
Acme Corp:   $567.89 (46%) ██████████████████
Beta Inc:    $234.56 (19%) ████████
Gamma LLC:   $123.45 (10%) ████
Others:      $308.66 (25%) ██████████
```

### Cost Trends

Track cost changes over time:

**Month-over-Month**

| Month | Requests | Cost | Change |
|-------|----------|------|--------|
| Jan 2024 | 12,459 | $1,234.56 | +8% |
| Dec 2023 | 11,543 | $1,142.78 | +12% |
| Nov 2023 | 10,299 | $1,019.45 | +5% |

### Savings from Smart Routing

See how much you're saving:

**This Month**
- Original cost (if all GPT-4): $2,134.56
- Actual cost (with routing): $1,234.56
- **Savings: $900.00 (42%)**

**Routing Breakdown**

| Route | Requests | Saved |
|-------|----------|-------|
| GPT-4 → GPT-3.5 | 5,234 | $678.90 |
| GPT-4 → GPT-4-Turbo | 1,456 | $221.10 |

## Usage Patterns

### Peak Usage Times

Identify when usage is highest:

**Requests by Hour of Day**

```
  8am ████████████████████ 1,234
 10am ██████████████████████████ 1,567
 12pm ████████████████████████ 1,456
  2pm ███████████████████ 1,123
  4pm ████████████████ 987
```

**Requests by Day of Week**

| Day | Requests | Cost |
|-----|----------|------|
| Monday | 2,345 | $234.56 |
| Tuesday | 2,567 | $256.78 |
| Wednesday | 2,234 | $223.45 |
| Thursday | 2,123 | $212.34 |
| Friday | 1,890 | $189.00 |
| Saturday | 890 | $89.01 |
| Sunday | 510 | $29.42 |

### Token Distribution

See how many tokens requests typically use:

**Token Count Distribution**

```
Requests
2000 ┤ ╭─╮
1500 ┤ │ │
1000 ┤ │ ╰╮  ╭─╮
 500 ┤╭╯  ╰──╯ ╰─╮
   0 ┴──────────────
    0-100  100-500  500-1K  1K+
    tokens tokens  tokens tokens
```

## Performance Metrics

### Latency

Track response times:

**Average Latency by Model**

| Model | Avg Latency | P95 | P99 |
|-------|-------------|-----|-----|
| gpt-3.5-turbo | 1.2s | 2.1s | 3.5s |
| gpt-4 | 2.8s | 4.2s | 6.1s |
| gpt-4-turbo | 1.8s | 3.0s | 4.5s |

**TokenTrail Overhead**
- Average: 45ms
- P95: 89ms
- P99: 142ms

### Success Rate

Monitor request success:

**This Month**
- Total Requests: 12,459
- Successful: 12,387 (99.42%)
- Failed: 72 (0.58%)

**Failure Reasons**

| Reason | Count | % |
|--------|-------|---|
| Rate limit | 45 | 62% |
| Invalid request | 15 | 21% |
| Timeout | 8 | 11% |
| Other | 4 | 6% |

## Custom Reports

### Create Reports

Build custom reports for specific needs:

**Example: Executive Summary**
```json
{
  "report_name": "Monthly Executive Summary",
  "metrics": [
    "total_cost",
    "total_requests",
    "cost_per_request",
    "savings_from_routing",
    "top_5_customers"
  ],
  "grouping": "month",
  "export": "pdf"
}
```

### Scheduled Reports

Automatically generate and email reports:

1. Go to **Analytics → Reports**
2. Click **Schedule Report**
3. Configure:
   - **Frequency**: Daily/Weekly/Monthly
   - **Recipients**: team@company.com
   - **Format**: PDF/CSV
   - **Metrics**: Select from list

**Example Schedule**:
- Every Monday at 9am
- Weekly summary report
- Email to finance@company.com
- Include cost breakdown by customer

## Exporting Data

### CSV Export

Download raw data for analysis:

```bash
curl "https://api.tokentrailapp.com/v1/analytics/export?format=csv&period=month" \
  -H "Authorization: Bearer tt_live_..." \
  -o usage_jan2024.csv
```

**CSV Format:**
```csv
timestamp,customer_id,model,tokens,cost_usd,feature,routing_applied
2024-01-01T10:30:00Z,customer_abc,gpt-4,1234,0.0123,chat,true
2024-01-01T10:31:15Z,customer_def,gpt-3.5-turbo,567,0.0005,summary,false
...
```

### JSON Export

For programmatic analysis:

```bash
curl "https://api.tokentrailapp.com/v1/analytics/export?format=json" \
  -H "Authorization: Bearer tt_live_..."
```

### API Access

Query analytics programmatically:

```javascript
const analytics = await fetch('https://api.tokentrailapp.com/v1/analytics/summary?period=month', {
  headers: { 'Authorization': 'Bearer tt_live_...' }
}).then(r => r.json())

console.log(analytics)
// {
//   period: '2024-01',
//   total_requests: 12459,
//   total_cost_usd: '1234.56',
//   ...
// }
```

## Budget Tracking

### Budget vs Actual

Track spending against budget:

**This Month**
- Budget: $1,500
- Actual: $1,234.56
- Remaining: $265.44 (18%)
- Projected end-of-month: $1,487.23 (on track)

**Visual:**
```
Budget: $1,500 ████████████████████████████████
Actual: $1,235 ████████████████████████░░░░░░░░
               82% used
```

### Burn Rate

See how fast you're spending:

**Daily Burn Rate**
- Average: $41.15/day
- Trend: Increasing (+2% per day)
- Forecast: Will reach monthly budget on Jan 28

## Alerts & Notifications

### Cost Alerts

Get notified when spending exceeds thresholds:

**Configure Alerts:**
1. **Daily spend > $100** → Email to finance@company.com
2. **Customer ABC > 80% of budget** → Slack #billing channel
3. **Unusual spike detected** → SMS to on-call

**Alert Example:**
```
🚨 Cost Alert

Daily spend threshold exceeded:
- Today's spend: $145.67
- Threshold: $100.00
- Increase: +45.67% vs threshold

Top contributors:
1. Acme Corp: $67.89
2. Beta Inc: $34.56

View details: https://app.tokentrailapp.com/analytics
```

## Advanced Analytics

### Cohort Analysis

Track usage patterns by customer cohort:

**Cohort: Customers who joined in Jan 2024**

| Week | Active Customers | Avg Cost/Customer |
|------|------------------|-------------------|
| Week 1 | 45 | $12.34 |
| Week 2 | 42 | $23.45 |
| Week 3 | 40 | $34.56 |
| Week 4 | 38 | $45.67 |

### Churn Prediction

Identify customers likely to reduce usage:

**At-Risk Customers**

| Customer | Current Usage | Trend | Risk |
|----------|---------------|-------|------|
| Beta Inc | $45/mo | -35% last 30d | 🔴 High |
| Delta Co | $78/mo | -15% last 30d | 🟡 Medium |

### Anomaly Detection

Automatically flag unusual patterns:

**Detected Anomalies**
1. **customer_abc**: Spike in usage (+300% vs baseline)
   - Time: 2024-01-15 14:30
   - Likely cause: Loop or automation error

2. **gpt-4-turbo**: Unusually high error rate (15% vs 2% avg)
   - Duration: 2024-01-16 08:00-10:00
   - Likely cause: Provider issue

## Integration with BI Tools

### Connect to Tableau/PowerBI

Export data for visualization in BI tools:

**Setup:**
1. Create API key with analytics scope
2. Configure data source in Tableau/PowerBI
3. Use TokenTrail API endpoint as datasource
4. Schedule automatic refresh

**Example Tableau Dashboard:**
- Total cost trend (line chart)
- Cost by customer (bar chart)
- Model distribution (pie chart)
- Geographic heatmap (if tracking location)

### SQL Access (Enterprise)

Direct SQL access to analytics warehouse:

```sql
SELECT
  DATE_TRUNC('day', timestamp) as date,
  customer_id,
  SUM(cost_usd) as daily_cost
FROM usage_events
WHERE timestamp >= '2024-01-01'
GROUP BY date, customer_id
ORDER BY daily_cost DESC;
```

## Next Steps

- [Budget Limits](./budget-limits.md) - Use analytics to set smart budgets
- [Smart Routing](./smart-routing.md) - Optimize based on usage patterns
- [Customer Tracking](./customer-tracking.md) - Dive deep into customer data
- [API Reference](./api-reference.md) - Programmatic access to analytics
