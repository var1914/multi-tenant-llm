/**
 * API Helpers for E2E Tests
 *
 * These helpers make real API calls to test complete user workflows.
 * Tests run against actual services (not mocked).
 */

export interface LLMRequestConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  messages: Array<{ role: 'user' | 'system' | 'assistant'; content: string }>;
  maxTokens?: number;
  customerId?: string;
}

export interface LLMResponse {
  success: boolean;
  model: string;
  routedModel?: string;
  content?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: string;
  latencyMs: number;
}

export interface TrialRequestData {
  email: string;
  full_name: string;
  company_name?: string;
  use_case: string;
}

export interface RoutingTestResult {
  original_model: string;
  routed_model: string;
  routing_applied: boolean;
  complexity_score: number;
  task_type: string;
  routellm_used: boolean;
  routellm_win_rate: number | null;
  routing_reason: string;
  estimated_savings_usd: number;
}

/**
 * Make a real LLM request through TokenTrail proxy
 */
export async function makeLLMRequest(config: LLMRequestConfig): Promise<LLMResponse> {
  const startTime = Date.now();

  try {
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    // Add customer ID header if provided
    if (config.customerId) {
      headers['X-Customer-ID'] = config.customerId;
    }

    const response = await fetch(`${config.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: config.messages,
        max_tokens: config.maxTokens || 100,
        temperature: 0.7,
      }),
    });

    const latencyMs = Date.now() - startTime;

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        model: config.model,
        error: `HTTP ${response.status}: ${errorText}`,
        latencyMs,
      };
    }

    const data = await response.json();

    return {
      success: true,
      model: config.model,
      routedModel: data.model,
      content: data.choices?.[0]?.message?.content,
      usage: data.usage,
      latencyMs,
    };
  } catch (error) {
    return {
      success: false,
      model: config.model,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startTime,
    };
  }
}

/**
 * Test routing decision via the playground API
 */
export async function testRoutingDecision(
  baseUrl: string,
  token: string,
  model: string,
  prompt: string
): Promise<RoutingTestResult | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/routing/test`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      console.error('Routing test failed:', await response.text());
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Routing test error:', error);
    return null;
  }
}

/**
 * Submit a trial request
 */
export async function submitTrialRequest(
  baseUrl: string,
  data: TrialRequestData
): Promise<{ success: boolean; requestId?: string; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/trial/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { success: false, error: errorData.detail };
    }

    const result = await response.json();
    return { success: true, requestId: result.request_id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Check trial status by email
 */
export async function checkTrialStatus(
  baseUrl: string,
  email: string
): Promise<{ status: string; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/trial/status/${encodeURIComponent(email)}`);
    return await response.json();
  } catch (error) {
    return { status: 'error', message: String(error) };
  }
}

/**
 * Get routing settings for the tenant
 */
export async function getRoutingSettings(
  baseUrl: string,
  token: string
): Promise<{
  smart_routing_enabled: boolean;
  routing_strategy: string;
  routellm_enabled: boolean;
  routellm_threshold: number;
  routellm_available: boolean;
} | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/routing/settings`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Update routing settings
 */
export async function updateRoutingSettings(
  baseUrl: string,
  token: string,
  settings: {
    smart_routing_enabled?: boolean;
    routing_strategy?: string;
    routellm_enabled?: boolean;
    routellm_threshold?: number;
  }
): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/routing/settings`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get routing statistics
 */
export async function getRoutingStats(
  baseUrl: string,
  token: string,
  days: number = 7
): Promise<{
  total_decisions: number;
  routing_applied_count: number;
  total_savings_usd: number;
} | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/routing/stats?days=${days}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Get dashboard usage stats
 */
export async function getDashboardStats(
  baseUrl: string,
  token: string
): Promise<{
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
} | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/dashboard/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Create an end customer
 */
export async function createCustomer(
  baseUrl: string,
  token: string,
  data: {
    external_id: string;
    name?: string;
    email?: string;
    budget_limit_usd?: number;
  }
): Promise<{ success: boolean; customerId?: string; error?: string }> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/customers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
      return { success: false, error: errorData.detail };
    }

    const result = await response.json();
    return { success: true, customerId: result.id };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

/**
 * Get customer usage
 */
export async function getCustomerUsage(
  baseUrl: string,
  token: string,
  customerId: string
): Promise<{
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
} | null> {
  try {
    const response = await fetch(`${baseUrl}/api/v1/customers/${customerId}/usage`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Wait for a condition with timeout
 */
export async function waitFor<T>(
  fn: () => Promise<T | null>,
  predicate: (result: T) => boolean,
  timeoutMs: number = 30000,
  intervalMs: number = 1000
): Promise<T | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await fn();
    if (result && predicate(result)) {
      return result;
    }
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return null;
}

/**
 * Test prompts categorized by complexity
 */
export const TEST_PROMPTS = {
  simple: [
    'What is 2 + 2?',
    'Hello, how are you?',
    'What color is the sky?',
    'Say hello in Spanish.',
  ],
  moderate: [
    'Explain what a REST API is in 2 sentences.',
    'What are the benefits of TypeScript?',
    'Compare arrays and linked lists.',
    'Write a haiku about programming.',
  ],
  complex: [
    'Design a distributed cache system with consistency guarantees. Include data structures, protocols, and failure handling.',
    'Analyze the trade-offs between microservices and monolithic architectures for a high-traffic e-commerce platform.',
    'Write a recursive algorithm to solve the Tower of Hanoi problem and explain its time complexity.',
    'Explain how consensus algorithms like Raft work and their guarantees.',
  ],
  coding: [
    'Write a Python function to find the longest palindromic substring.',
    'Implement a binary search tree with insert, delete, and search operations in TypeScript.',
    'Create a React hook for debouncing API calls with cleanup.',
  ],
};