import { test, expect, Page } from '@playwright/test';

/**
 * UsageFlow Demo Video Script
 *
 * This test is designed for recording a professional demo video.
 * Run with: npm test -- --project=demo tests/demo-showcase.spec.ts
 *
 * For best results:
 * 1. Use OBS or native screen recording at 1080p/4K
 * 2. Run this script while recording
 * 3. Add AI voiceover using the script below
 */

const API_URL = 'http://localhost:8000/api/v1';

// Helper to pause for demo narration
async function pause(page: Page, seconds: number, label?: string) {
  if (label) console.log(`⏸️  ${label}`);
  await page.waitForTimeout(seconds * 1000);
}

// Helper for smooth navigation
async function navigateTo(page: Page, menuItem: string) {
  await page.click(`nav >> text=${menuItem}`);
  await page.waitForLoadState('networkidle');
  await pause(page, 1.5);
}

test.describe('UsageFlow Product Demo', () => {

  test('Complete Feature Showcase', async ({ page }) => {
    test.setTimeout(600000); // 10 minutes for full demo

    const timestamp = Date.now();
    const demoUser = {
      email: `demo_${timestamp}@usageflow.com`,
      password: 'DemoPassword123!',
      company: 'Acme AI Corp',
    };

    // ============================================================
    // INTRO: Landing/Login Page
    // ============================================================
    console.log('\n🎬 SCENE 1: Welcome to UsageFlow\n');

    await page.goto('/login');
    await pause(page, 3, 'Show login page - professional SaaS interface');

    // ============================================================
    // SCENE 1: Registration - Onboarding Flow
    // ============================================================
    console.log('\n🎬 SCENE 2: Quick Registration\n');

    await page.goto('/register');
    await pause(page, 2, 'Registration page');

    // Fill form slowly for demo
    await page.fill('input[placeholder*="company" i], input[name="company_name"]', '');
    await page.type('input[placeholder*="company" i], input[name="company_name"]', demoUser.company, { delay: 80 });
    await pause(page, 1);

    await page.type('input[type="email"]', demoUser.email, { delay: 50 });
    await pause(page, 1);

    await page.type('input[type="password"]', demoUser.password, { delay: 50 });
    await pause(page, 1.5);

    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    await pause(page, 3, 'Dashboard loaded - show overview');

    // Get auth token for API calls
    const loginResponse = await page.request.post(`${API_URL}/auth/login`, {
      data: { email: demoUser.email, password: demoUser.password },
    });
    const { access_token: token } = await loginResponse.json();

    // ============================================================
    // SCENE 2: Dashboard Overview
    // ============================================================
    console.log('\n🎬 SCENE 3: Dashboard Overview\n');

    await navigateTo(page, 'Dashboard');
    await pause(page, 4, 'Main dashboard with metrics');

    // ============================================================
    // SCENE 3: API Key Management
    // ============================================================
    console.log('\n🎬 SCENE 4: API Key Management\n');

    await navigateTo(page, 'API Keys');
    await pause(page, 2, 'API Keys page');

    // Create API key
    await page.click('button:has-text("Create"), button:has-text("Generate"), button:has-text("New")');
    await pause(page, 1);

    // Fill key name
    const keyNameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
    if (await keyNameInput.isVisible()) {
      await keyNameInput.type('Production API Key', { delay: 60 });
      await pause(page, 1);
    }

    await page.click('button:has-text("Create"), button:has-text("Generate")');
    await pause(page, 2);

    // Get API key for later use
    const apiKeyResponse = await page.request.post(`${API_URL}/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Demo Key' },
    });
    const { key: apiKey } = await apiKeyResponse.json();

    await pause(page, 3, 'Show created API key');

    // ============================================================
    // SCENE 4: Customer Management
    // ============================================================
    console.log('\n🎬 SCENE 5: Customer Management\n');

    await navigateTo(page, 'Customers');
    await pause(page, 2, 'Customers page');

    // Create customers via API for demo
    const customers = [
      { id: `enterprise_${timestamp}`, name: 'Enterprise Corp', budget: 100.00, action: 'pause' },
      { id: `startup_${timestamp}`, name: 'AI Startup Inc', budget: 25.00, action: 'alert' },
      { id: `research_${timestamp}`, name: 'Research Lab', budget: 50.00, action: 'pause' },
    ];

    for (const customer of customers) {
      await page.request.post(`${API_URL}/customers`, {
        headers: { Authorization: `Bearer ${token}` },
        data: {
          external_id: customer.id,
          name: customer.name,
          email: `${customer.id}@example.com`,
          workflow_budget: customer.budget,
          workflow_budget_action: customer.action,
        },
      });
    }

    await page.reload();
    await page.waitForLoadState('networkidle');
    await pause(page, 4, 'Show customer list with budgets');

    // Highlight budget settings
    await expect(page.getByText('Enterprise Corp')).toBeVisible();
    await expect(page.getByText('Auto-pause')).toBeVisible();
    await pause(page, 3, 'Show budget protection badges');

    // ============================================================
    // SCENE 5: Workflow Tracking (Agentic AI)
    // ============================================================
    console.log('\n🎬 SCENE 6: Agentic AI Workflow Tracking\n');

    await navigateTo(page, 'Workflows');
    await pause(page, 2, 'Workflows page');

    // Create demo workflows via API
    const workflows = [
      { name: 'Customer Research Analysis', type: 'research', customer: customers[0].id },
      { name: 'Code Review Agent', type: 'code_review', customer: customers[1].id },
      { name: 'Document Summarization', type: 'summarization', customer: customers[2].id },
    ];

    for (const wf of workflows) {
      const startRes = await page.request.post(`${API_URL}/workflows/start`, {
        headers: { Authorization: apiKey },
        data: {
          workflow_name: wf.name,
          workflow_type: wf.type,
          customer_id: wf.customer,
        },
      });
      const { workflow_id } = await startRes.json();

      // Add steps
      const agents = ['planner', 'researcher', 'analyst', 'writer'];
      for (let i = 0; i < agents.length; i++) {
        await page.request.post(`${API_URL}/workflows/${workflow_id}/step`, {
          headers: { Authorization: apiKey },
          data: {
            agent_name: agents[i],
            model_used: i % 2 === 0 ? 'gpt-4' : 'claude-3-opus',
            tokens_used: 1000 + (i * 500),
            cost: 0.05 + (i * 0.03),
          },
        });
      }

      // Complete workflow
      await page.request.post(`${API_URL}/workflows/${workflow_id}/complete`, {
        headers: { Authorization: apiKey },
        data: { outcome: 'success' },
      });
    }

    // Show Overview tab
    await page.click('button:has-text("Overview")');
    await page.reload();
    await pause(page, 4, 'Workflow analytics overview');

    // Show List tab
    await page.click('button:has-text("List")');
    await pause(page, 4, 'Workflow list with status');

    // Click on a workflow to show details
    await page.click('text=Customer Research Analysis');
    await pause(page, 4, 'Workflow details modal');

    // Close modal
    await page.keyboard.press('Escape');
    await pause(page, 1);

    // ============================================================
    // SCENE 6: Budget Guards in Action
    // ============================================================
    console.log('\n🎬 SCENE 7: Budget Guards - Auto Protection\n');

    // Create a workflow that will exceed budget
    const budgetTestCustomer = `budget_demo_${timestamp}`;
    await page.request.post(`${API_URL}/customers`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        external_id: budgetTestCustomer,
        name: 'Budget Demo Customer',
        email: `budget@example.com`,
        workflow_budget: 0.10, // Very low budget
        workflow_budget_action: 'pause',
      },
    });

    const budgetWfRes = await page.request.post(`${API_URL}/workflows/start`, {
      headers: { Authorization: apiKey },
      data: {
        workflow_name: 'Budget Test Workflow',
        workflow_type: 'test',
        customer_id: budgetTestCustomer,
      },
    });
    const { workflow_id: budgetWfId } = await budgetWfRes.json();

    // Add steps until budget exceeded
    await page.request.post(`${API_URL}/workflows/${budgetWfId}/step`, {
      headers: { Authorization: apiKey },
      data: { agent_name: 'step1', model_used: 'gpt-4', tokens_used: 1000, cost: 0.05 },
    });

    const pausedStep = await page.request.post(`${API_URL}/workflows/${budgetWfId}/step`, {
      headers: { Authorization: apiKey },
      data: { agent_name: 'step2', model_used: 'gpt-4', tokens_used: 1000, cost: 0.08 },
    });
    const pausedData = await pausedStep.json();

    await page.reload();
    await pause(page, 3, 'Show paused workflow in list');

    // Highlight the paused status
    await expect(page.locator('text=paused').first()).toBeVisible();
    await pause(page, 3, 'Budget guard automatically paused the workflow');

    // ============================================================
    // SCENE 7: Agent Efficiency Analytics
    // ============================================================
    console.log('\n🎬 SCENE 8: Agent Efficiency & Analytics\n');

    await navigateTo(page, 'Agent Efficiency');
    await pause(page, 3, 'Agent Efficiency page');

    // Show summary cards
    await expect(page.locator('text=/Total Agents/i')).toBeVisible();
    await expect(page.locator('text=/Average Efficiency/i')).toBeVisible();
    await pause(page, 4, 'Summary metrics');

    // Show agent table
    await expect(page.locator('text=planner')).toBeVisible();
    await expect(page.locator('text=researcher')).toBeVisible();
    await pause(page, 4, 'Agent performance table');

    // ============================================================
    // SCENE 8: Outcome-Based Pricing
    // ============================================================
    console.log('\n🎬 SCENE 9: Outcome-Based Pricing\n');

    await page.click('button:has-text("Outcome Pricing")');
    await pause(page, 2, 'Outcome pricing tab');

    // Create pricing rule
    await page.click('button:has-text("Add Pricing Rule")');
    await pause(page, 1);

    await page.fill('input[placeholder*="code_review" i]', 'research');
    await page.fill('input[placeholder*="0.10" i]', '0.75');
    await page.fill('input[type="number"]:last-of-type', '5');
    await pause(page, 2, 'Configure outcome pricing');

    await page.click('button:has-text("Create")');
    await pause(page, 3, 'Pricing rule created');

    // ============================================================
    // SCENE 9: AI Recommendations
    // ============================================================
    console.log('\n🎬 SCENE 10: AI-Powered Recommendations\n');

    await page.click('button:has-text("Recommendations")');
    await pause(page, 2, 'Recommendations tab');

    await expect(page.locator('text=Potential Savings').first()).toBeVisible();
    await pause(page, 5, 'Show cost optimization recommendations');

    // ============================================================
    // SCENE 10: Predictions & Alerts
    // ============================================================
    console.log('\n🎬 SCENE 11: Predictive Analytics\n');

    await navigateTo(page, 'Predictions');
    await pause(page, 4, 'Predictions page with alerts');

    // ============================================================
    // SCENE 11: Smart Routing
    // ============================================================
    console.log('\n🎬 SCENE 12: Smart Model Routing\n');

    await navigateTo(page, 'Smart Routing');
    await pause(page, 4, 'Smart routing configuration');

    // ============================================================
    // SCENE 12: Analytics Deep Dive
    // ============================================================
    console.log('\n🎬 SCENE 13: Analytics Dashboard\n');

    await navigateTo(page, 'Analytics');
    await pause(page, 5, 'Analytics charts and insights');

    // ============================================================
    // SCENE 13: Billing
    // ============================================================
    console.log('\n🎬 SCENE 14: Billing & Invoicing\n');

    await navigateTo(page, 'Billing');
    await pause(page, 4, 'Billing overview');

    // ============================================================
    // FINALE: Return to Dashboard
    // ============================================================
    console.log('\n🎬 SCENE 15: Finale\n');

    await navigateTo(page, 'Dashboard');
    await pause(page, 5, 'Back to dashboard - complete platform overview');

    console.log('\n========================================');
    console.log('🎬 DEMO RECORDING COMPLETE');
    console.log('========================================\n');
  });
});
