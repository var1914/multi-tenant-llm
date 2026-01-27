#!/usr/bin/env npx ts-node

/**
 * TokenTrail Usage Data Generator
 *
 * This script makes LLM calls through the TokenTrail proxy to generate
 * real usage data for testing dashboards, analytics, and billing.
 *
 * Prerequisites:
 * 1. TokenTrail backend running with LiteLLM configured
 * 2. Provider API keys (OpenAI/Anthropic) configured in LiteLLM
 * 3. A TokenTrail API key from the UI
 *
 * Usage:
 *   TOKENTRAIL_API_KEY=your_key npx ts-node generate-usage-data.ts
 *
 * Or with custom base URL:
 *   TOKENTRAIL_API_KEY=your_key BASE_URL=http://localhost:4000 npx ts-node generate-usage-data.ts
 */

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

interface UsageInfo {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: UsageInfo;
}

// Configuration
const API_KEY = process.env.TOKENTRAIL_API_KEY;
const BASE_URL = process.env.BASE_URL || 'https://tokentrailapp.com';

// Test scenarios with varying complexity/cost
const TEST_SCENARIOS = [
  {
    name: 'Simple greeting',
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user' as const, content: 'Hello! How are you today?' }],
    max_tokens: 50,
  },
  {
    name: 'Code explanation',
    model: 'gpt-4o',
    messages: [
      { role: 'user' as const, content: 'Explain what a REST API is in 2 sentences.' }
    ],
    max_tokens: 100,
  },
  {
    name: 'Creative writing',
    model: 'gpt-4-turbo',
    messages: [
      { role: 'system' as const, content: 'You are a creative writer.' },
      { role: 'user' as const, content: 'Write a haiku about cloud computing.' }
    ],
    max_tokens: 50,
  },
  {
    name: 'Analysis task',
    model: 'claude-3-5-sonnet',
    messages: [
      { role: 'user' as const, content: 'What are 3 benefits of using TypeScript over JavaScript?' }
    ],
    max_tokens: 150,
  },
  {
    name: 'Quick question',
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'user' as const, content: 'What is 2 + 2?' }
    ],
    max_tokens: 10,
  },
];

async function makeRequest(scenario: typeof TEST_SCENARIOS[0]): Promise<{
  success: boolean;
  model: string;
  tokens?: UsageInfo;
  error?: string;
  latency: number;
}> {
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: scenario.model,
        messages: scenario.messages,
        max_tokens: scenario.max_tokens,
        temperature: 0.7,
      } as ChatCompletionRequest),
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        model: scenario.model,
        error: `HTTP ${response.status}: ${errorText}`,
        latency,
      };
    }

    const data = await response.json() as ChatCompletionResponse;

    return {
      success: true,
      model: data.model || scenario.model,
      tokens: data.usage,
      latency,
    };
  } catch (error) {
    return {
      success: false,
      model: scenario.model,
      error: error instanceof Error ? error.message : String(error),
      latency: Date.now() - startTime,
    };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  TokenTrail Usage Data Generator');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (!API_KEY) {
    console.error('❌ Error: TOKENTRAIL_API_KEY environment variable is required');
    console.log('\nUsage:');
    console.log('  TOKENTRAIL_API_KEY=your_key npx ts-node generate-usage-data.ts\n');
    console.log('Get your API key from: https://tokentrailapp.com/app/api-keys');
    process.exit(1);
  }

  console.log(`📡 Target: ${BASE_URL}`);
  console.log(`🔑 API Key: ${API_KEY.substring(0, 8)}...${API_KEY.substring(API_KEY.length - 4)}`);
  console.log(`📊 Scenarios: ${TEST_SCENARIOS.length}\n`);

  let totalTokens = 0;
  let successCount = 0;
  let failCount = 0;
  const results: Array<{ name: string; result: Awaited<ReturnType<typeof makeRequest>> }> = [];

  for (const scenario of TEST_SCENARIOS) {
    process.stdout.write(`  ⏳ ${scenario.name} (${scenario.model})...`);

    const result = await makeRequest(scenario);
    results.push({ name: scenario.name, result });

    if (result.success) {
      successCount++;
      totalTokens += result.tokens?.total_tokens || 0;
      console.log(` ✅ ${result.tokens?.total_tokens || 0} tokens (${result.latency}ms)`);
    } else {
      failCount++;
      console.log(` ❌ ${result.error}`);
    }

    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Summary');
  console.log('═══════════════════════════════════════════════════════════');
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log(`  📊 Total tokens: ${totalTokens}`);
  console.log('═══════════════════════════════════════════════════════════\n');

  if (successCount > 0) {
    console.log('🎉 Usage data generated! Check your TokenTrail dashboard:');
    console.log(`   ${BASE_URL}/app/dashboard\n`);
  }

  if (failCount > 0) {
    console.log('⚠️  Some requests failed. Common issues:');
    console.log('   - Invalid API key');
    console.log('   - Provider API keys not configured in LiteLLM');
    console.log('   - Rate limiting');
    console.log('   - Network issues\n');
  }
}

main().catch(console.error);
