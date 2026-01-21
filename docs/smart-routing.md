# Smart Routing

Automatically route requests to the most cost-effective model without sacrificing quality. Save 40-60% on LLM costs instantly.

## What is Smart Routing?

Smart Routing analyzes each request's complexity and automatically routes it to the cheapest model that can handle it well.

**Example:**
- Simple question: `"What is 2+2?"` → Routed to `gpt-3.5-turbo` (saves 91%)
- Complex analysis: `"Analyze this legal contract..."` → Routed to `gpt-4` (maintains quality)

You request `gpt-4` for everything, but only pay for it when you really need it.

## How It Works

```
1. You request gpt-4
   ↓
2. TokenTrail analyzes request complexity
   ↓
3. Complexity score: 0.0-1.0
   ↓
4a. Simple (< 0.4) → Route to gpt-3.5-turbo (save 91%)
4b. Medium (0.4-0.7) → Route to gpt-4-turbo (save 50%)
4c. Complex (> 0.7) → Keep gpt-4 (maintain quality)
   ↓
5. Response returned to your app
```

**Latency Impact:** <5ms added for complexity analysis

## Complexity Analysis

TokenTrail scores request complexity (0.0-1.0) based on:

### Message Factors
- **Length**: Longer prompts = higher complexity
- **Structure**: Multiple messages, system prompts = higher
- **Instructions**: Detailed requirements = higher

### Content Patterns

**Simple (0.0-0.3):**
```
- "What is the capital of France?"
- "Translate 'hello' to Spanish"
- "Give me a random number between 1-10"
```

**Medium (0.4-0.6):**
```
- "Write a 3-paragraph blog post about AI"
- "Summarize this 500-word article"
- "Create a simple SQL query for user data"
```

**Complex (0.7-1.0):**
```
- "Analyze this 10-page legal contract for risks"
- "Debug this complex React component"
- "Write a comprehensive business plan"
```

## Enabling Smart Routing

### Via Dashboard

1. Go to **Settings → Smart Routing**
2. Toggle **"Enable Smart Routing"** ON
3. Configure routing rules:

```
Simple queries (0.0-0.4):
gpt-4 → gpt-3.5-turbo
Savings: ~91% per request

Medium queries (0.4-0.7):
gpt-4 → gpt-4-turbo
Savings: ~50% per request

Complex queries (0.7-1.0):
gpt-4 → gpt-4 (no change)
Savings: 0%
```

4. Click **Save**

### Via API

```bash
curl -X PATCH https://api.tokentrail.io/v1/settings/routing \
  -H "Authorization: Bearer tt_live_..." \
  -d '{
    "smart_routing_enabled": true,
    "rules": [
      {
        "source_model": "gpt-4",
        "complexity_max": 0.4,
        "target_model": "gpt-3.5-turbo"
      },
      {
        "source_model": "gpt-4",
        "complexity_min": 0.4,
        "complexity_max": 0.7,
        "target_model": "gpt-4-turbo"
      }
    ]
  }'
```

## Routing Rules

### Default Rules

TokenTrail comes with sensible defaults:

| Source Model | Complexity | Target Model | Savings |
|--------------|-----------|--------------|---------|
| gpt-4 | 0.0-0.4 | gpt-3.5-turbo | 91% |
| gpt-4 | 0.4-0.7 | gpt-4-turbo | 50% |
| gpt-4 | 0.7-1.0 | gpt-4 | 0% |
| claude-3-opus | 0.0-0.5 | claude-3-haiku | 83% |
| claude-3-opus | 0.5-1.0 | claude-3-sonnet | 40% |

### Custom Rules

Create your own routing logic:

**Example: Aggressive savings**
```json
{
  "rules": [
    {
      "source_model": "gpt-4",
      "complexity_max": 0.6,  // Route more to cheaper model
      "target_model": "gpt-3.5-turbo"
    }
  ]
}
```

**Example: Quality-first**
```json
{
  "rules": [
    {
      "source_model": "gpt-4",
      "complexity_max": 0.2,  // Only route very simple queries
      "target_model": "gpt-3.5-turbo"
    }
  ]
}
```

**Example: Feature-specific**
```json
{
  "rules": [
    {
      "source_model": "gpt-4",
      "metadata": { "feature": "chat_support" },
      "target_model": "gpt-3.5-turbo"  // Chat always uses cheaper model
    },
    {
      "source_model": "gpt-4",
      "metadata": { "feature": "code_review" },
      "target_model": "gpt-4"  // Code review always uses best model
    }
  ]
}
```

## Monitoring Routing Decisions

### Dashboard View

**Analytics → Smart Routing** shows:

- **Total Requests**: 1,247
- **Routed**: 823 (66%)
- **Not Routed**: 424 (34%)
- **Total Savings**: $234.56 this month

**Routing Breakdown:**
| From | To | Requests | Savings |
|------|-----|----------|---------|
| gpt-4 | gpt-3.5-turbo | 652 | $189.23 |
| gpt-4 | gpt-4-turbo | 171 | $45.33 |

### Per-Request Details

Each request shows routing info:

```json
{
  "request_id": "req_abc123",
  "original_model": "gpt-4",
  "routed_model": "gpt-3.5-turbo",
  "routing_applied": true,
  "complexity_score": 0.23,
  "original_cost": "$0.0254",
  "actual_cost": "$0.0023",
  "savings": "$0.0231 (91%)"
}
```

### API Query

```bash
curl https://api.tokentrail.io/v1/analytics/routing \
  -H "Authorization: Bearer tt_live_..."
```

**Response:**
```json
{
  "period": "2024-01",
  "total_requests": 1247,
  "routed_requests": 823,
  "routing_rate": 0.66,
  "total_savings_usd": "234.56",
  "breakdown": [
    {
      "source": "gpt-4",
      "target": "gpt-3.5-turbo",
      "count": 652,
      "savings_usd": "189.23"
    }
  ]
}
```

## Testing Routing

### Test Specific Queries

See how TokenTrail would route a query:

```bash
curl -X POST https://api.tokentrail.io/v1/routing/test \
  -H "Authorization: Bearer tt_live_..." \
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ]
  }'
```

**Response:**
```json
{
  "original_model": "gpt-4",
  "routed_model": "gpt-3.5-turbo",
  "would_route": true,
  "complexity_score": 0.12,
  "estimated_savings_usd": 0.0231,
  "reason": "Simple arithmetic question"
}
```

### A/B Testing

Compare quality with/without routing:

1. Enable routing for 50% of traffic
2. Track user satisfaction metrics
3. Compare output quality
4. Adjust complexity thresholds based on results

## Quality Assurance

### Confidence Scores

TokenTrail includes confidence in routing decisions:

```json
{
  "routing_applied": true,
  "complexity_score": 0.35,
  "confidence": 0.92,  // 92% confident in this routing
}
```

**Low confidence (<0.7)**: Route conservatively (use better model)

### Manual Overrides

Force specific models for critical requests:

```javascript
// Override routing for this specific request
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  metadata: {
    disable_routing: true  // Always use gpt-4
  }
})
```

### Quality Feedback

Report routing quality issues:

```bash
curl -X POST https://api.tokentrail.io/v1/routing/feedback \
  -H "Authorization: Bearer tt_live_..." \
  -d '{
    "request_id": "req_abc123",
    "feedback": "negative",
    "reason": "Response quality was poor, should have used gpt-4"
  }'
```

TokenTrail learns from feedback and adjusts routing over time.

## Cost Savings Examples

### Example 1: SaaS Chat Support

**Before Smart Routing:**
- 10,000 requests/month
- All use gpt-4
- Cost: $254/month

**After Smart Routing:**
- 6,500 routed to gpt-3.5-turbo (simple)
- 2,500 routed to gpt-4-turbo (medium)
- 1,000 keep gpt-4 (complex)
- **New cost: $87/month**
- **Savings: $167/month (66%)**

### Example 2: Code Assistant

**Before:**
- 5,000 code generations/month
- All use gpt-4
- Cost: $1,270/month

**After:**
- 1,000 simple snippets → gpt-3.5-turbo
- 2,000 medium functions → gpt-4-turbo
- 2,000 complex refactors → gpt-4
- **New cost: $712/month**
- **Savings: $558/month (44%)**

## Best Practices

### 1. Start Conservative

Begin with high complexity thresholds:

```json
{
  "complexity_max": 0.3  // Only route very simple queries
}
```

Monitor quality, then increase threshold to save more.

### 2. Feature-Specific Rules

Different features need different models:

```javascript
// Customer-facing chat: prioritize cost
metadata: { feature: 'support', routing: 'aggressive' }

// Code generation: prioritize quality
metadata: { feature: 'codegen', routing: 'conservative' }
```

### 3. Monitor Quality Metrics

Track these alongside cost savings:
- User satisfaction scores
- Task completion rates
- Error rates
- Response quality ratings

### 4. Gradual Rollout

1. **Week 1**: Enable for 10% of traffic
2. **Week 2**: Increase to 50% if quality is good
3. **Week 3**: Roll out to 100%
4. **Ongoing**: Monitor and adjust thresholds

### 5. Customer Segmentation

Route differently based on customer tier:

```javascript
// Free tier: aggressive routing (maximize savings)
if (customer.tier === 'free') {
  metadata.routing_mode = 'aggressive'
}

// Enterprise tier: conservative (prioritize quality)
if (customer.tier === 'enterprise') {
  metadata.routing_mode = 'conservative'
}
```

## Limitations

### What Routing Can't Do

❌ **Can't improve bad prompts**: Routing works best with well-structured prompts
❌ **Can't guarantee identical output**: Different models produce different outputs
❌ **Can't route mid-conversation**: Each message is routed independently

### When to Disable Routing

Disable for:
- Mission-critical operations (financial calculations, medical advice)
- Legal/compliance requirements (must use specific model)
- Customer-facing demos (need consistent behavior)
- First-time users (want best experience)

## FAQ

**Q: Will users notice the model switch?**
A: For simple queries, usually no. The response quality is equivalent. For edge cases, you can disable routing for specific features.

**Q: Can I see which model was actually used?**
A: Yes, check the `routed_model` field in the response metadata or dashboard.

**Q: What if the cheaper model fails?**
A: TokenTrail automatically falls back to the original model requested.

**Q: Does routing work with streaming?**
A: Yes, routing happens before streaming starts. The routed model then streams the response.

**Q: Can I route to custom models?**
A: Yes, configure any model supported by TokenTrail (OpenAI, Anthropic, Azure, etc.)

## Next Steps

- [Budget Limits](./budget-limits.md) - Combine routing with spending controls
- [Analytics](./analytics.md) - Visualize your savings
- [Customer Tracking](./customer-tracking.md) - Track routing per customer
