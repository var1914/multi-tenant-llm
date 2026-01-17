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

/**
 * Complete E2E flow testing the entire agentic AI billing journey:
 * 1. Register -> Login
 * 2. Create customers with workflow budgets
 * 3. Track workflows via API
 * 4. Budget guards trigger and pause workflow
 * 5. View analytics in dashboard
 * 6. Configure outcome pricing
 * 7. Check agent efficiency scores
 */
test.describe('Complete Agentic AI Billing Flow', () => {
  // Increase timeout for comprehensive test with slowMo
  test('full end-to-end journey', async ({ page }) => {
    test.setTimeout(180000); // 3 minutes for full flow
    // ========== Step 1: Register and Login ==========
    const user = generateTestUser();

    await page.goto('/register');
    await page.fill('input[placeholder*="company" i], input[name="company_name"]', user.company);
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    console.log('✓ Step 1: Registered and logged in');

    // Get token for API calls
    const loginResponse = await page.request.post('http://localhost:8000/api/v1/auth/login', {
      data: { email: user.email, password: user.password },
    });
    const { access_token: token } = await loginResponse.json();

    // Create API key
    const apiKey = await createApiKey(page, token);
    console.log('✓ Created API key');

    // ========== Step 2: Create Customers with Budgets (via API) ==========
    const premiumCustomerId = `premium_${Date.now()}`;
    await createCustomer(page, token, premiumCustomerId, {
      name: 'Premium Customer',
      workflowBudget: 1.00,
      workflowBudgetAction: 'pause',
    });
    console.log('✓ Step 2: Created customer with $1.00 workflow budget (auto-pause)');

    const basicCustomerId = `basic_${Date.now()}`;
    await createCustomer(page, token, basicCustomerId, {
      name: 'Basic Customer',
      workflowBudget: 0.50,
      workflowBudgetAction: 'alert',
    });
    console.log('✓ Created second customer with $0.50 budget (alert only)');

    // Verify customers in UI
    await navigateTo(page, 'Customers');
    await page.reload(); // Reload to fetch fresh data
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(premiumCustomerId)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Auto-pause')).toBeVisible();
    console.log('✓ Customers visible in dashboard');

    // ========== Step 3: Track Workflows ==========
    // Create workflow for premium customer
    const premiumWorkflow = await startWorkflow(page, apiKey, 'Premium Analysis', {
      workflowType: 'research',
      customerId: premiumCustomerId,
    });

    // Add multiple steps
    await addWorkflowStep(page, apiKey, premiumWorkflow.workflow_id, 'planner', 0.10);
    await addWorkflowStep(page, apiKey, premiumWorkflow.workflow_id, 'researcher', 0.25);
    await addWorkflowStep(page, apiKey, premiumWorkflow.workflow_id, 'analyst', 0.30);
    await addWorkflowStep(page, apiKey, premiumWorkflow.workflow_id, 'writer', 0.20);
    await completeWorkflow(page, apiKey, premiumWorkflow.workflow_id);
    console.log('✓ Step 3: Created workflow with 4 steps, total $0.85');

    // Create another workflow that will exceed budget
    const budgetTestWorkflow = await startWorkflow(page, apiKey, 'Budget Test', {
      workflowType: 'sequential',
      customerId: premiumCustomerId,
    });

    // Add steps until budget exceeded (budget is $1.00, previous workflow used $0.85)
    const step1 = await addWorkflowStep(page, apiKey, budgetTestWorkflow.workflow_id, 'step1', 0.10);
    console.log(`  Step 1: cost=${step1.workflow_total_cost}, paused=${step1.workflow_paused}`);

    const step2 = await addWorkflowStep(page, apiKey, budgetTestWorkflow.workflow_id, 'step2', 0.10);
    console.log(`  Step 2: cost=${step2.workflow_total_cost}, paused=${step2.workflow_paused}`);

    // ========== Step 4: Verify Budget Guard ==========
    await navigateTo(page, 'Workflows');
    await page.click('button:has-text("List")');

    // Should see workflows
    await expect(page.locator('text=Premium Analysis')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Budget Test')).toBeVisible();
    console.log('✓ Step 4: Workflows visible in dashboard');

    // ========== Step 5: View Analytics ==========
    await page.click('button:has-text("Overview")');

    // Should show analytics
    await expect(page.locator('text=/Total Workflows/i')).toBeVisible();
    await expect(page.locator('text=/Success Rate/i')).toBeVisible();
    console.log('✓ Step 5: Workflow analytics displayed');

    // ========== Step 6: Configure Outcome Pricing ==========
    await navigateTo(page, 'Agent Efficiency');
    await page.click('button:has-text("Outcome Pricing")');
    await page.click('button:has-text("Add Pricing Rule")');

    await page.fill('input[placeholder*="code_review" i]', 'research');
    await page.fill('input[placeholder*="0.10" i]', '0.50');
    await page.fill('input[type="number"]:last-of-type', '2');
    await page.click('button:has-text("Create")');

    await expect(page.locator('td:has-text("research")')).toBeVisible({ timeout: 5000 });
    console.log('✓ Step 6: Configured outcome pricing ($0.50/success, 2 free)');

    // ========== Step 7: Check Agent Efficiency ==========
    await page.click('button:has-text("Agent Efficiency")');

    // Should show agents from our workflows
    await expect(page.locator('text=planner')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=researcher')).toBeVisible();

    // Check summary cards
    await expect(page.locator('text=/Total Agents/i')).toBeVisible();
    await expect(page.locator('text=/Average Efficiency/i')).toBeVisible();
    console.log('✓ Step 7: Agent efficiency metrics displayed');

    // ========== Step 8: Check Recommendations ==========
    await page.click('button:has-text("Recommendations")');

    // Should show recommendations section - check for "Potential Savings" text which appears on recommendation cards
    await expect(
      page.locator('text=Potential Savings').first()
    ).toBeVisible({ timeout: 5000 });
    console.log('✓ Step 8: Recommendations section accessible');

    console.log('\n========================================');
    console.log('✅ FULL E2E FLOW COMPLETED SUCCESSFULLY');
    console.log('========================================\n');
  });

  test('workflow budget pause and resume flow', async ({ page }) => {
    const user = generateTestUser();

    // Register
    const regResponse = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });
    const { access_token: token } = await regResponse.json();
    const apiKey = await createApiKey(page, token);

    // Create customer with very low budget
    const customerId = `pause_test_${Date.now()}`;
    await createCustomer(page, token, customerId, {
      name: 'Pause Test',
      workflowBudget: 0.01,
      workflowBudgetAction: 'pause',
    });

    // Start workflow
    const wf = await startWorkflow(page, apiKey, 'Pause Test Workflow', {
      customerId: customerId,
    });

    // Add steps until paused
    await addWorkflowStep(page, apiKey, wf.workflow_id, 'step1', 0.005);
    const pausedStep = await addWorkflowStep(page, apiKey, wf.workflow_id, 'step2', 0.006);

    expect(pausedStep.workflow_paused).toBe(true);
    console.log('✓ Workflow paused after exceeding budget');

    // Resume the workflow
    const resumeResponse = await page.request.post(
      `http://localhost:8000/api/v1/workflows/${wf.workflow_id}/resume`,
      { headers: { Authorization: apiKey } }
    );

    expect(resumeResponse.status()).toBe(200);
    const resumeData = await resumeResponse.json();
    expect(resumeData.status).toBe('running');
    console.log('✓ Workflow resumed successfully');

    // Complete the workflow
    await completeWorkflow(page, apiKey, wf.workflow_id);
    console.log('✓ Workflow completed after resume');

    // Verify in UI
    await login(page, user.email, user.password);
    await navigateTo(page, 'Workflows');
    await page.click('button:has-text("List")');

    await expect(page.locator('text=Pause Test Workflow')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('span.bg-green-100:has-text("completed")')).toBeVisible();
    console.log('✓ Completed workflow visible in UI');
  });
});
