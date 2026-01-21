---
layout: home

hero:
  name: "TokenTrail"
  text: "Track, control, and optimize your LLM costs"
  tagline: See exactly where your AI budget goes. Set spending limits. Save 40-60% with smart routing.
  image:
    src: /logo.svg
    alt: TokenTrail
  actions:
    - theme: brand
      text: Get Started
      link: /getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/tokentrailapp/tokentrail

features:
  - icon: 🛡️
    title: Budget Limits & Auto-Blocking
    details: Set monthly spending caps per customer. Automatically block requests when limits are exceeded to prevent runaway costs.
  - icon: ⚡
    title: Smart Model Routing
    details: Automatically route simple queries to cheaper models like GPT-3.5, keep complex ones on GPT-4. Save 40-60% instantly.
  - icon: 📊
    title: Per-Customer Tracking
    details: See exactly what each customer costs you. Track usage by customer, feature, model, and time period.
  - icon: 🔔
    title: Real-Time Alerts
    details: Get notified when customers hit 80% of their budget. Set up Slack or email alerts for anomalies.
  - icon: 💳
    title: Customer Billing
    details: Bill your customers based on actual LLM usage. Export usage data or integrate with Stripe for automated billing.
  - icon: 🚀
    title: No SDK Required
    details: Works with your existing OpenAI/Anthropic SDK. Just change the baseURL—no code changes needed.
---

## Why TokenTrail?

<div class="vp-doc">

### The Problem

Building with LLMs is expensive and unpredictable:

- 💸 **"We had no idea Feature X was costing us $12k/month until it was too late"**
- 🔥 **"A customer ran an infinite loop and burned $5,000 in 2 hours"**
- 🎯 **"We're using GPT-4 for everything, even simple tasks"**
- 📊 **"We can't bill customers because we can't track their usage"**

### The Solution

TokenTrail gives you complete control over LLM costs:

1. **Track** every API call by customer, feature, and model
2. **Control** spending with budget limits and automatic blocking
3. **Optimize** costs with smart routing (40-60% savings)
4. **Bill** customers accurately based on actual usage

</div>

## Quick Example

```javascript
import OpenAI from 'openai'

// Just change the baseURL and apiKey
const client = new OpenAI({
  baseURL: 'https://api.tokentrailapp.com/v1',  // ← Add this
  apiKey: 'tt_live_...'                     // ← Your TokenTrail key
})

// Use as normal - TokenTrail handles everything
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  user: 'customer_123'  // ← Track this customer
})
```

**That's it!** Now check your dashboard to see:
- ✅ Request tracked
- 💰 Cost calculated ($0.0003)
- 👤 Customer identified
- ⚡ Smart routing applied (saved 91%)

## Features at a Glance

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Tracked requests/mo | 10K | 500K | Unlimited |
| Budget limits & blocking | ✅ | ✅ | ✅ |
| Smart routing | ❌ | ✅ | ✅ |
| Per-customer billing | ❌ | ✅ | ✅ |
| Data retention | 7 days | 90 days | Custom |
| Support | Community | Priority | Dedicated |
| Price | **Free** | **$29/mo** | **Custom** |

## Getting Started

<div class="vp-doc">

1. [Create an account](https://tokentrailapp.com/register) (free, no credit card)
2. [Get your API key](https://app.tokentrailapp.com/settings/api-keys)
3. [Update your code](/getting-started) (just change baseURL)
4. [Set budget limits](/budget-limits) (optional but recommended)
5. [Enable smart routing](/smart-routing) (save 40-60%)

**Ready in 5 minutes. No SDK, no complex setup.**

</div>

## Community & Support

- 💬 [Discord Community](https://discord.gg/tokentrail)
- 📧 [Email Support](mailto:tokentrailapp@gmail.com)
- 🐛 [Report Issues](https://github.com/tokentrailapp/tokentrail/issues)
- 📚 [Full Documentation](/getting-started)

---

<div class="vp-doc" style="text-align: center; margin-top: 3rem;">

**Stop overspending on LLM APIs. Start tracking with TokenTrail.**

[Get Started for Free →](/getting-started)

</div>
