# Getting Started with TokenTrail

Get TokenTrail up and running in 5 minutes. No SDK required—just point your existing OpenAI or Anthropic client to TokenTrail's proxy.

## Step 1: Create Your Account

1. Visit [tokentrail.io/register](https://tokentrail.io/register)
2. Sign up with your email
3. Verify your email address
4. You're in! 🎉

## Step 2: Get Your API Key

1. Go to **Settings → API Keys** in the dashboard
2. Click **"Create API Key"**
3. Choose environment:
   - **Test** (`tt_test_...`) - for development
   - **Live** (`tt_live_...`) - for production
4. Copy your API key (you won't see it again!)

```bash
# Your API key looks like this:
tt_live_abc123def456ghi789
```

## Step 3: Point Your App to TokenTrail

TokenTrail works as a proxy. You keep using your existing OpenAI/Anthropic SDK—just change the `baseURL`.

### For OpenAI (Node.js)

```javascript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.tokentrail.io/v1',  // ← Add this line
  apiKey: 'tt_live_abc123...',              // ← Use your TokenTrail key
})

// Use as normal - TokenTrail tracks everything automatically
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
  user: 'customer_123',  // ← Track this customer (optional but recommended)
})
```

### For OpenAI (Python)

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://api.tokentrail.io/v1",  # ← Add this line
    api_key="tt_live_abc123..."               # ← Use your TokenTrail key
)

# Use as normal
response = client.chat.completions.create(
    model="gpt-4",
    messages=[{"role": "user", "content": "Hello!"}],
    user="customer_123"  # ← Track this customer (optional but recommended)
)
```

### For Anthropic (Node.js)

```javascript
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  baseURL: 'https://api.tokentrail.io/v1',  // ← Add this line
  apiKey: 'tt_live_abc123...',              // ← Use your TokenTrail key
})

const response = await client.messages.create({
  model: 'claude-3-opus-20240229',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
})
```

## Step 4: Add Your LLM Provider Keys

TokenTrail needs your actual OpenAI/Anthropic API keys to make requests on your behalf.

1. Go to **Settings → Integrations**
2. Add your provider API keys:
   - **OpenAI API Key**: `sk-...` from [platform.openai.com](https://platform.openai.com/api-keys)
   - **Anthropic API Key**: `sk-ant-...` from [console.anthropic.com](https://console.anthropic.com/)

🔒 **Security Note**: Your provider keys are encrypted at rest and never exposed in logs or responses.

## Step 5: Track Your First Request

Make a request from your app and watch it appear in the TokenTrail dashboard!

```javascript
// Make a request
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'What is 2+2?' }],
  user: 'customer_123',
})

console.log(response.choices[0].message.content)
```

Then check your dashboard:
1. Go to **Dashboard** in TokenTrail
2. You'll see:
   - ✅ Request tracked
   - 💰 Cost calculated ($0.0003)
   - 👤 Customer ID (`customer_123`)
   - 🏷️ Model used (`gpt-4`)
   - ⚡ Tokens consumed (50 tokens)

## Step 6: Enable Smart Routing (Optional)

Save 40-60% automatically by routing simple queries to cheaper models.

1. Go to **Settings → Smart Routing**
2. Toggle **"Enable Smart Routing"** ON
3. Configure rules:
   - Simple queries → `gpt-3.5-turbo` (saves 90%)
   - Complex queries → `gpt-4`

Now make the same request again and watch TokenTrail route it to `gpt-3.5-turbo` if it's simple enough!

## Step 7: Set Budget Limits (Optional)

Prevent runaway costs by setting monthly spending limits per customer.

1. Go to **Customers** page
2. Click on a customer (or create one)
3. Set **Monthly Budget Limit**: `$100.00`
4. Enable **"Block requests when limit exceeded"**

Now if `customer_123` tries to use more than $100 in a month, their requests will be automatically rejected.

## What's Next?

You're all set! Here are some next steps:

- 📊 [Customer Tracking](./customer-tracking.md) - Learn how to track usage per customer
- 💰 [Budget Limits](./budget-limits.md) - Deep dive into spending controls
- ⚡ [Smart Routing](./smart-routing.md) - Optimize your cost savings
- 📈 [Analytics](./analytics.md) - Understand your usage patterns
- 💳 [Billing](./billing.md) - Bill your customers for AI usage

## Common Issues

### "Invalid API key"
- Make sure you're using your TokenTrail API key (`tt_live_...`), not your OpenAI key
- Check that the key is active in **Settings → API Keys**

### "Provider API key not configured"
- Add your OpenAI/Anthropic keys in **Settings → Integrations**

### "Request not showing in dashboard"
- Check that you're using the correct `baseURL`
- Look in the **Test** environment if you're using a `tt_test_...` key

### High latency
- TokenTrail adds <50ms overhead on average
- If you're seeing higher latency, check your network connection or contact support

## Need Help?

- 📧 Email: [support@tokentrail.io](mailto:support@tokentrail.io)
- 💬 Discord: [Join our community](https://discord.gg/tokentrail)
- 🐛 Report bugs: [GitHub Issues](https://github.com/tokentrail/tokentrail/issues)
