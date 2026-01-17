import { Page, expect } from '@playwright/test';

const API_URL = 'http://localhost:8000/api/v1';

// Generate unique test data
export function generateTestUser() {
  const suffix = Math.random().toString(36).substring(2, 8);
  return {
    email: `e2e_test_${suffix}@usageflow.com`,
    password: 'Test123!@#',
    company: `E2E Test Company ${suffix}`,
  };
}

// Register a new user via API and return credentials
export async function registerUser(page: Page) {
  const user = generateTestUser();

  const response = await page.request.post(`${API_URL}/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      company_name: user.company,
    },
  });

  const data = await response.json();
  return {
    ...user,
    token: data.access_token,
  };
}

// Login via UI
export async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for redirect to dashboard
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

// Navigate to a page via sidebar
export async function navigateTo(page: Page, pageName: string) {
  await page.click(`nav a:has-text("${pageName}")`);
  await page.waitForLoadState('networkidle');
}

// Create API key via API
export async function createApiKey(page: Page, token: string, name: string = 'e2e-test') {
  const response = await page.request.post(`${API_URL}/api-keys`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name },
  });

  const data = await response.json();
  return data.key;
}

// Create customer via API
export async function createCustomer(
  page: Page,
  token: string,
  externalId: string,
  options: {
    name?: string;
    workflowBudget?: number;
    workflowBudgetAction?: 'alert' | 'pause';
  } = {}
) {
  const response = await page.request.post(`${API_URL}/customers`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      external_id: externalId,
      name: options.name || `Customer ${externalId}`,
      workflow_budget_usd: options.workflowBudget,
      workflow_budget_action: options.workflowBudgetAction || 'alert',
    },
  });

  return response.json();
}

// Start workflow via API
export async function startWorkflow(
  page: Page,
  apiKey: string,
  workflowName: string,
  options: {
    workflowType?: string;
    customerId?: string;
  } = {}
) {
  const response = await page.request.post(`${API_URL}/workflows/start`, {
    headers: { Authorization: apiKey },
    data: {
      workflow_name: workflowName,
      workflow_type: options.workflowType || 'sequential',
      customer_id: options.customerId,
    },
  });

  return response.json();
}

// Add workflow step via API
export async function addWorkflowStep(
  page: Page,
  apiKey: string,
  workflowId: string,
  agentName: string,
  cost: number = 0.001
) {
  const response = await page.request.post(`${API_URL}/workflows/${workflowId}/step`, {
    headers: { Authorization: apiKey },
    data: {
      agent_name: agentName,
      agent_type: 'execution',
      llm_calls: 1,
      tokens_used: 500,
      cost_usd: cost,
    },
  });

  return response.json();
}

// Complete workflow via API
export async function completeWorkflow(page: Page, apiKey: string, workflowId: string) {
  const response = await page.request.post(`${API_URL}/workflows/${workflowId}/complete`, {
    headers: { Authorization: apiKey },
    data: { status: 'completed' },
  });

  return response.json();
}

// Wait for toast message
export async function expectToast(page: Page, text: string) {
  await expect(page.locator(`text=${text}`)).toBeVisible({ timeout: 5000 });
}
