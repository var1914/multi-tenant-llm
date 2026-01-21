# Integration Guide

Complete guide to integrating TokenTrail with your application. Works with any LLM provider that uses OpenAI or Anthropic's API format.

## Quick Reference

**TokenTrail Proxy URL**: `https://api.tokentrailapp.com/v1`

Replace your existing `baseURL` with TokenTrail's proxy and use your TokenTrail API key instead of your provider key.

## Supported Providers

- ✅ **OpenAI** - GPT-4, GPT-3.5, GPT-4 Turbo
- ✅ **Anthropic** - Claude 3 (Opus, Sonnet, Haiku)
- ✅ **Azure OpenAI** - All models
- ✅ **OpenAI-compatible APIs** - Together AI, Anyscale, etc.

## Integration Steps

### 1. Get Your TokenTrail API Key

```bash
# From the dashboard: Settings → API Keys → Create API Key
tt_live_abc123def456...  # Production
tt_test_xyz789...        # Development
```

### 2. Add Provider Credentials

In TokenTrail dashboard: **Settings → Integrations**

- Add your OpenAI key: `sk-proj-...`
- Add your Anthropic key: `sk-ant-...`

### 3. Update Your Code

Just change `baseURL` and `apiKey` in your existing client:

**Before (Direct to OpenAI):**
```javascript
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})
```

**After (Via TokenTrail):**
```javascript
const client = new OpenAI({
  baseURL: 'https://api.tokentrailapp.com/v1',
  apiKey: process.env.TOKENTRAIL_API_KEY  // tt_live_...
})
```

That's it! No code changes needed—TokenTrail is a drop-in replacement.

## Language-Specific Examples

### Node.js (TypeScript)

```typescript
import OpenAI from 'openai'

const client = new OpenAI({
  baseURL: 'https://api.tokentrailapp.com/v1',
  apiKey: process.env.TOKENTRAIL_API_KEY!,
})

async function chat(customerId: string, message: string) {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: message }],
    user: customerId,  // Track this customer
  })

  return response.choices[0].message.content
}

// Usage
const reply = await chat('customer_123', 'What is 2+2?')
console.log(reply)
```

### Python

```python
import os
from openai import OpenAI

client = OpenAI(
    base_url="https://api.tokentrailapp.com/v1",
    api_key=os.getenv("TOKENTRAIL_API_KEY")
)

def chat(customer_id: str, message: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4",
        messages=[{"role": "user", "content": message}],
        user=customer_id  # Track this customer
    )

    return response.choices[0].message.content

# Usage
reply = chat("customer_123", "What is 2+2?")
print(reply)
```

### Ruby

```ruby
require 'openai'

client = OpenAI::Client.new(
  uri_base: 'https://api.tokentrailapp.com/v1',
  access_token: ENV['TOKENTRAIL_API_KEY']
)

response = client.chat(
  parameters: {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello!' }],
    user: 'customer_123'
  }
)

puts response.dig('choices', 0, 'message', 'content')
```

### Go

```go
package main

import (
    "context"
    "fmt"
    "os"

    openai "github.com/sashabaranov/go-openai"
)

func main() {
    config := openai.DefaultConfig(os.Getenv("TOKENTRAIL_API_KEY"))
    config.BaseURL = "https://api.tokentrailapp.com/v1"

    client := openai.NewClientWithConfig(config)

    resp, err := client.CreateChatCompletion(
        context.Background(),
        openai.ChatCompletionRequest{
            Model: openai.GPT4,
            Messages: []openai.ChatCompletionMessage{
                {
                    Role:    openai.ChatMessageRoleUser,
                    Content: "Hello!",
                },
            },
            User: "customer_123",
        },
    )

    if err != nil {
        fmt.Printf("Error: %v\n", err)
        return
    }

    fmt.Println(resp.Choices[0].Message.Content)
}
```

### PHP

```php
<?php
require 'vendor/autoload.php';

use OpenAI\Client;

$client = OpenAI::factory()
    ->withBaseUri('https://api.tokentrailapp.com/v1')
    ->withApiKey($_ENV['TOKENTRAIL_API_KEY'])
    ->make();

$response = $client->chat()->create([
    'model' => 'gpt-4',
    'messages' => [
        ['role' => 'user', 'content' => 'Hello!'],
    ],
    'user' => 'customer_123',
]);

echo $response->choices[0]->message->content;
```

## Advanced Usage

### Track Customers

Always pass a `user` parameter to track usage per customer:

```javascript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_123',  // ← Important!
})
```

This enables:
- Per-customer usage tracking
- Budget limits per customer
- Customer-specific analytics

### Handle Budget Limit Errors

When a customer exceeds their budget:

```javascript
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4',
    messages: [...],
    user: 'customer_123',
  })
} catch (error) {
  if (error.status === 429 && error.type === 'budget_limit_exceeded') {
    // Customer is over budget
    console.log('Budget exceeded:', error.message)

    // Show upgrade prompt to user
    showUpgradePrompt()
  } else {
    // Other error (rate limit, API error, etc.)
    throw error
  }
}
```

### Stream Responses

Streaming works exactly the same:

```javascript
const stream = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_123',
  stream: true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '')
}
```

TokenTrail tracks the full response once streaming is complete.

### Custom Metadata

Add custom metadata to track usage by feature, environment, etc:

```javascript
const response = await client.chat.completions.create({
  model: 'gpt-4',
  messages: [...],
  user: 'customer_123',
  // Custom metadata (stored in TokenTrail)
  metadata: {
    feature: 'chat_support',
    environment: 'production',
    version: 'v2.0',
  }
})
```

Access this data in TokenTrail analytics and exports.

## Self-Hosted Deployment

Running TokenTrail on your own infrastructure:

### Using Docker Compose

```bash
# Clone the repository
git clone https://github.com/tokentrailapp/tokentrail.git
cd tokentrail

# Copy environment file
cp .env.example .env

# Edit .env with your settings
nano .env

# Start all services
docker-compose up -d
```

### Environment Variables

```bash
# .env file
POSTGRES_USER=tokentrail
POSTGRES_PASSWORD=your-secure-password
POSTGRES_DB=tokentrail

# Your OpenAI/Anthropic keys
OPENAI_API_KEY=sk-proj-...
ANTHROPIC_API_KEY=sk-ant-...

# JWT secret for authentication
JWT_SECRET_KEY=your-random-secret-key

# LiteLLM configuration
LITELLM_MASTER_KEY=sk-litellm-master-key
LITELLM_SALT_KEY=sk-litellm-salt-key

# TokenTrail callback
TOKENTRAIL_INTERNAL_API_KEY=internal-api-key
```

### Access Your Instance

```javascript
// Point to your self-hosted instance
const client = new OpenAI({
  baseURL: 'https://your-tokentrail-instance.com/v1',
  apiKey: 'tt_live_...'  // From your instance
})
```

## Testing

### Test with cURL

```bash
curl https://api.tokentrailapp.com/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer tt_live_..." \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ],
    "user": "customer_123"
  }'
```

### Test Environment

Use `tt_test_...` keys for development:

```javascript
const client = new OpenAI({
  baseURL: 'https://api.tokentrailapp.com/v1',
  apiKey: process.env.NODE_ENV === 'production'
    ? process.env.TOKENTRAIL_LIVE_KEY   // tt_live_...
    : process.env.TOKENTRAIL_TEST_KEY   // tt_test_...
})
```

Test and live environments are completely separate.

## Migration Checklist

Migrating from direct OpenAI/Anthropic to TokenTrail:

- [ ] Create TokenTrail account
- [ ] Get TokenTrail API key (`tt_live_...`)
- [ ] Add provider keys in TokenTrail dashboard
- [ ] Update `baseURL` in your code
- [ ] Update `apiKey` to use TokenTrail key
- [ ] Add `user` parameter for customer tracking
- [ ] Test in development first (`tt_test_...`)
- [ ] Deploy to production
- [ ] Verify requests appear in TokenTrail dashboard
- [ ] Set up budget limits (optional)
- [ ] Enable smart routing (optional)

## Troubleshooting

### Requests not showing in dashboard

**Check:** Are you using the correct base URL?
```javascript
baseURL: 'https://api.tokentrailapp.com/v1'  // ✅ Correct
baseURL: 'https://api.openai.com/v1'     // ❌ Wrong
```

**Check:** Is your API key correct?
```javascript
apiKey: 'tt_live_...'  // ✅ TokenTrail key
apiKey: 'sk-proj-...'  // ❌ OpenAI key
```

### "Invalid API key" error

- Verify key is active in **Settings → API Keys**
- Check you're using the right environment (`tt_live_` vs `tt_test_`)
- Ensure key hasn't been deleted or rotated

### "Provider API key not configured"

Add your OpenAI/Anthropic keys in **Settings → Integrations**

### High latency

TokenTrail adds <50ms overhead on average. If you're seeing higher:
- Check your network latency to TokenTrail servers
- Verify you're not rate-limited
- Contact support with request IDs

## Support

- 📧 Email: tokentrailapp@gmail.com
- 💬 Discord: [Join community](https://discord.gg/tokentrail)
- 📚 More docs: [docs.tokentrailapp.com](https://docs.tokentrailapp.com)
