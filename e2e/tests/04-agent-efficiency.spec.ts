import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  login,
  navigateTo,
  createApiKey,
  startWorkflow,
  addWorkflowStep,
  completeWorkflow,
} from './helpers';

test.describe('Agent Efficiency & Outcome Billing', () => {
  let user: { email: string; password: string; company: string; token: string };
  let apiKey: string;

  test.beforeEach(async ({ page }) => {
    user = generateTestUser() as typeof user;

    const response = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    const data = await response.json();
    user.token = data.access_token;
    apiKey = await createApiKey(page, user.token);

    // Create some workflows with different agents
    for (let i = 0; i < 3; i++) {
      const wf = await startWorkflow(page, apiKey, `Efficiency Test ${i}`, {
        workflowType: 'research',
      });

      // Add steps from different agents
      await addWorkflowStep(page, apiKey, wf.workflow_id, 'planner', 0.002);
      await addWorkflowStep(page, apiKey, wf.workflow_id, 'researcher', 0.005);
      await addWorkflowStep(page, apiKey, wf.workflow_id, 'writer', 0.003);

      await completeWorkflow(page, apiKey, wf.workflow_id);
    }

    await login(page, user.email, user.password);
  });

  test('should display agent efficiency page', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Should show page title
    await expect(page.locator('h1:has-text("Agent Efficiency")')).toBeVisible();

    // Should show tabs
    await expect(page.locator('button:has-text("Agent Efficiency")')).toBeVisible();
    await expect(page.locator('button:has-text("Outcome Pricing")')).toBeVisible();
    await expect(page.locator('button:has-text("Recommendations")')).toBeVisible();
  });

  test('should show summary cards', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Should show summary cards
    await expect(page.locator('text=/Total Agents/i')).toBeVisible();
    await expect(page.locator('text=/Average Efficiency/i')).toBeVisible();
    await expect(page.locator('text=/Total Cost/i')).toBeVisible();
  });

  test('should display agent efficiency table', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Should show agents in table
    await expect(page.locator('text=planner')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=researcher')).toBeVisible();
    await expect(page.locator('text=writer')).toBeVisible();

    // Should show efficiency scores
    await expect(page.locator('table td:has-text(/\\d+/)')).toBeVisible();
  });

  test('should show agent recommendations', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Click on Recommendations tab
    await page.click('button:has-text("Recommendations")');

    // Should show recommendations section (may be empty or have items)
    await expect(
      page.locator('text=/No optimization recommendations|improve|reduce/i')
    ).toBeVisible({ timeout: 5000 });
  });

  test('should create outcome pricing rule', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Switch to Outcome Pricing tab
    await page.click('button:has-text("Outcome Pricing")');

    // Click add pricing button
    await page.click('button:has-text("Add Pricing Rule")');

    // Fill the form
    await page.fill('input[placeholder*="code_review" i]', 'research');
    await page.fill('input[placeholder*="0.10" i]', '0.15');
    await page.fill('input[type="number"]:last-of-type', '5');

    // Submit
    await page.click('button:has-text("Create")');

    // Should show the new pricing rule
    await expect(page.locator('td:has-text("research")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('td:has-text("$0.15")')).toBeVisible();
  });

  test('should delete outcome pricing rule', async ({ page }) => {
    // First create a pricing rule via API
    await page.request.post('http://localhost:8000/api/v1/agentic/outcome-pricing', {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        workflow_type: 'delete_test',
        billing_model: 'per_outcome',
        price_per_success: 0.25,
        free_attempts: 0,
      },
    });

    await navigateTo(page, 'Agent Efficiency');
    await page.click('button:has-text("Outcome Pricing")');

    // Should show the pricing rule
    await expect(page.locator('text=delete_test')).toBeVisible({ timeout: 5000 });

    // Click delete
    await page.click('tr:has-text("delete_test") button:has-text("Delete")');

    // Should be removed
    await expect(page.locator('text=delete_test')).not.toBeVisible({ timeout: 5000 });
  });

  test('should show efficiency scores with colors', async ({ page }) => {
    await navigateTo(page, 'Agent Efficiency');

    // Scores should be displayed with colored badges
    await expect(page.locator('.bg-green-100, .bg-yellow-100, .bg-orange-100, .bg-red-100')).toBeVisible();
  });
});

test.describe('Efficiency API Integration', () => {
  test('should calculate efficiency correctly via API', async ({ page }) => {
    const user = generateTestUser();

    const regResponse = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    const { access_token: token } = await regResponse.json();
    const apiKeyResponse = await page.request.post('http://localhost:8000/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'test' },
    });
    const apiKey = (await apiKeyResponse.json()).key;

    // Create workflow with specific agents
    const wf = await startWorkflow(page, apiKey, 'API Test', { workflowType: 'sequential' });
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'fast_agent', 0.001);
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'expensive_agent', 0.010);
    await completeWorkflow(page, apiKey, wf.workflow_id);

    // Get efficiency metrics via API
    const efficiencyResponse = await page.request.get(
      'http://localhost:8000/api/v1/agentic/efficiency/agents?days=30',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const agents = await efficiencyResponse.json();

    // Should have both agents
    const agentNames = agents.map((a: { agent_name: string }) => a.agent_name);
    expect(agentNames).toContain('fast_agent');
    expect(agentNames).toContain('expensive_agent');

    // Each agent should have efficiency score
    for (const agent of agents) {
      expect(agent.efficiency_score).toBeGreaterThanOrEqual(0);
      expect(agent.efficiency_score).toBeLessThanOrEqual(100);
    }
  });

  test('should get agent comparison summary', async ({ page }) => {
    const user = generateTestUser();

    const regResponse = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    const { access_token: token } = await regResponse.json();
    const apiKeyResponse = await page.request.post('http://localhost:8000/api/v1/api-keys', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'test' },
    });
    const apiKey = (await apiKeyResponse.json()).key;

    // Create workflows
    for (let i = 0; i < 2; i++) {
      const wf = await startWorkflow(page, apiKey, `Comparison Test ${i}`, {});
      await addWorkflowStep(page, apiKey, wf.workflow_id, `agent_${i}`, 0.002);
      await completeWorkflow(page, apiKey, wf.workflow_id);
    }

    // Get comparison
    const compResponse = await page.request.get(
      'http://localhost:8000/api/v1/agentic/efficiency/comparison?days=30',
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const comparison = await compResponse.json();

    expect(comparison.total_agents).toBeGreaterThanOrEqual(2);
    expect(comparison.best_performer).toBeDefined();
    expect(comparison.worst_performer).toBeDefined();
    expect(comparison.average_efficiency).toBeGreaterThan(0);
  });
});
