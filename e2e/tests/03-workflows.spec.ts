import { test, expect } from '@playwright/test';
import {
  generateTestUser,
  login,
  navigateTo,
  createApiKey,
  createCustomer,
  startWorkflow,
  addWorkflowStep,
  completeWorkflow,
} from './helpers';

test.describe('Workflow Tracking', () => {
  let user: { email: string; password: string; company: string; token: string };
  let apiKey: string;

  test.beforeEach(async ({ page }) => {
    // Register user
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

    // Create API key
    apiKey = await createApiKey(page, user.token);

    await login(page, user.email, user.password);
  });

  test('should display workflows page with tabs', async ({ page }) => {
    await navigateTo(page, 'Workflows');

    // Should show workflows heading
    await expect(page.locator('h1:has-text("Workflows")')).toBeVisible();

    // Should show tabs
    await expect(page.locator('button:has-text("Overview"), nav button:has-text("Overview")')).toBeVisible();
    await expect(page.locator('button:has-text("List"), nav button:has-text("List")')).toBeVisible();
  });

  test('should show workflow after API creation', async ({ page }) => {
    // Create a workflow via API
    const workflow = await startWorkflow(page, apiKey, 'E2E Test Workflow', {
      workflowType: 'sequential',
    });

    // Add some steps
    await addWorkflowStep(page, apiKey, workflow.workflow_id, 'planner', 0.002);
    await addWorkflowStep(page, apiKey, workflow.workflow_id, 'executor', 0.003);

    // Complete the workflow
    await completeWorkflow(page, apiKey, workflow.workflow_id);

    // Navigate to workflows page
    await navigateTo(page, 'Workflows');

    // Switch to List tab
    await page.click('button:has-text("List")');

    // Should show the workflow
    await expect(page.locator('text=E2E Test Workflow')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=completed')).toBeVisible();
  });

  test('should show workflow analytics', async ({ page }) => {
    // Create multiple workflows
    for (let i = 0; i < 3; i++) {
      const wf = await startWorkflow(page, apiKey, `Analytics Test ${i}`, { workflowType: 'sequential' });
      await addWorkflowStep(page, apiKey, wf.workflow_id, 'agent', 0.001 * (i + 1));
      await completeWorkflow(page, apiKey, wf.workflow_id);
    }

    await navigateTo(page, 'Workflows');

    // Should show analytics cards
    await expect(page.locator('text=/Total Workflows/i')).toBeVisible();
    await expect(page.locator('text=/Success Rate/i')).toBeVisible();
  });

  test('should show workflow details in modal', async ({ page }) => {
    // Create a workflow with steps
    const wf = await startWorkflow(page, apiKey, 'Detail Test Workflow', { workflowType: 'parallel' });
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'step1', 0.001);
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'step2', 0.002);
    await completeWorkflow(page, apiKey, wf.workflow_id);

    await navigateTo(page, 'Workflows');
    await page.click('button:has-text("List")');

    // Click on the workflow to see details
    await page.click('text=Detail Test Workflow');

    // Modal should show steps
    await expect(page.locator('text=step1')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=step2')).toBeVisible();
  });

  test('should track workflow for specific customer', async ({ page }) => {
    // Create a customer
    const customerId = `wf_customer_${Date.now()}`;
    await createCustomer(page, user.token, customerId, { name: 'Workflow Customer' });

    // Create workflow for this customer
    const wf = await startWorkflow(page, apiKey, 'Customer Workflow', {
      workflowType: 'sequential',
      customerId: customerId,
    });
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'agent', 0.005);
    await completeWorkflow(page, apiKey, wf.workflow_id);

    await navigateTo(page, 'Workflows');
    await page.click('button:has-text("List")');

    // Should show customer association
    await expect(page.locator('text=Customer Workflow')).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Workflow Budget Guards', () => {
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
  });

  test('should pause workflow when budget exceeded', async ({ page }) => {
    // Create customer with low budget and pause action
    const customerId = `budget_test_${Date.now()}`;
    await createCustomer(page, user.token, customerId, {
      name: 'Budget Test',
      workflowBudget: 0.005, // Very low budget
      workflowBudgetAction: 'pause',
    });

    // Start workflow for this customer
    const wf = await startWorkflow(page, apiKey, 'Budget Test Workflow', {
      customerId: customerId,
    });

    // Add steps that exceed budget
    const step1 = await addWorkflowStep(page, apiKey, wf.workflow_id, 'step1', 0.003);
    expect(step1.budget_exceeded).toBe(false);

    const step2 = await addWorkflowStep(page, apiKey, wf.workflow_id, 'step2', 0.003);
    expect(step2.budget_exceeded).toBe(true);
    expect(step2.workflow_paused).toBe(true);
    expect(step2.budget_warning).toContain('exceeded');

    // Login and check workflows page shows paused status
    await login(page, user.email, user.password);
    await navigateTo(page, 'Workflows');
    await page.click('button:has-text("List")');

    await expect(page.locator('text=paused_over_budget')).toBeVisible({ timeout: 5000 });
  });

  test('should alert but not pause when action is alert', async ({ page }) => {
    const customerId = `alert_test_${Date.now()}`;
    await createCustomer(page, user.token, customerId, {
      name: 'Alert Test',
      workflowBudget: 0.005,
      workflowBudgetAction: 'alert', // Only alert, don't pause
    });

    const wf = await startWorkflow(page, apiKey, 'Alert Test Workflow', {
      customerId: customerId,
    });

    const step1 = await addWorkflowStep(page, apiKey, wf.workflow_id, 'step1', 0.003);
    const step2 = await addWorkflowStep(page, apiKey, wf.workflow_id, 'step2', 0.003);

    // Should be over budget but NOT paused
    expect(step2.budget_exceeded).toBe(true);
    expect(step2.workflow_paused).toBe(false);
  });
});
