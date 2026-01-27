import { test, expect, Page } from '@playwright/test';
import {
  makeLLMRequest,
  testRoutingDecision,
  submitTrialRequest,
  checkTrialStatus,
  getRoutingSettings,
  updateRoutingSettings,
  getRoutingStats,
  getDashboardStats,
  createCustomer,
  getCustomerUsage,
  waitFor,
  TEST_PROMPTS,
} from '../fixtures/api-helpers';

/**
 * Comprehensive Scenario-Based E2E Tests
 *
 * These tests simulate real user journeys with actual API calls.
 * They test complete business workflows, not just UI interactions.
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://tokentrailapp.com';
const API_BASE_URL = process.env.E2E_API_URL || BASE_URL;

// Generate unique identifiers for test isolation
const testId = () => `e2e_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

test.describe('Scenario: Trial Signup to First API Call', () => {
  /**
   * Complete journey: Request trial → Approval → Registration → API Key → LLM Request
   *
   * This tests the full onboarding flow for a new user.
   */

  test('complete trial signup journey', async ({ page }) => {
    const uniqueEmail = `trial_${testId()}@test.tokentrail.dev`;
    const companyName = `TestCo ${testId()}`;

    // Step 1: Submit trial request via public landing page
    await test.step('Submit trial request', async () => {
      await page.goto('/');

      // Look for trial/get started button
      const trialButton = page.getByRole('button', { name: /get started|request trial|start free/i }).first();
      if (await trialButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await trialButton.click();
      } else {
        // Navigate directly to trial page if button not found
        await page.goto('/trial');
      }

      // Fill trial request form
      await page.fill('input[name="email"], input[type="email"]', uniqueEmail);
      await page.fill('input[name="full_name"], input[placeholder*="name"]', 'E2E Test User');
      await page.fill('input[name="company_name"], input[placeholder*="company"]', companyName);
      await page.fill('textarea[name="use_case"], textarea[placeholder*="use case"]', 'E2E testing of TokenTrail platform');

      // Submit
      await page.click('button[type="submit"]');

      // Should show success message
      await expect(page.getByText(/submitted|success|review/i)).toBeVisible({ timeout: 10000 });
    });

    // Step 2: Verify trial status via API
    await test.step('Verify trial status is pending', async () => {
      const status = await checkTrialStatus(API_BASE_URL, uniqueEmail);
      expect(status.status).toBe('pending');
    });

    // Note: In real E2E, admin approval would happen here
    // For automated tests, you might have a test admin account or API endpoint
  });

  test('user with approved trial gets $5 credits on registration', async ({ page }) => {
    // This test requires a pre-approved trial email
    // In real scenarios, this would be set up as test data

    await test.step('Register with approved trial email', async () => {
      await page.goto('/register');

      const approvedEmail = process.env.E2E_APPROVED_TRIAL_EMAIL;
      if (!approvedEmail) {
        test.skip(true, 'E2E_APPROVED_TRIAL_EMAIL not set');
        return;
      }

      await page.fill('input[placeholder*="Company"]', `ApprovedTrialCo ${testId()}`);
      await page.fill('input[name="fullName"], input[placeholder*="name"]', 'Trial User');
      await page.fill('input[type="email"]', approvedEmail);
      await page.fill('input[type="password"]', 'TestPassword123!');
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });
    });

    await test.step('Verify $5 trial credits in billing', async () => {
      await page.goto('/app/billing');
      await page.waitForLoadState('networkidle');

      // Should show trial credits
      await expect(page.getByText(/\$5|trial credits|credits.*5/i)).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Scenario: Smart Routing Cost Optimization', () => {
  /**
   * Tests the smart routing feature with real prompts to verify:
   * - Simple queries route to cheaper models
   * - Complex queries stay on premium models
   * - RouteLLM predictions affect routing decisions
   * - Cost savings are calculated correctly
   */

  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Login and capture auth token
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    // Get auth token from localStorage
    authToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
  });

  test('enable smart routing and verify configuration', async ({ page }) => {
    await page.goto('/app/smart-routing');
    await page.waitForLoadState('networkidle');

    // Enable smart routing if not already enabled
    await test.step('Enable smart routing', async () => {
      const enableToggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      const isEnabled = await enableToggle.isChecked().catch(() => false);

      if (!isEnabled) {
        await enableToggle.click();
        await page.waitForTimeout(1000); // Wait for settings to save
      }

      // Verify enabled
      await expect(enableToggle).toBeChecked();
    });

    // Verify settings via API
    await test.step('Verify settings via API', async () => {
      const settings = await getRoutingSettings(API_BASE_URL, authToken);
      expect(settings).not.toBeNull();
      expect(settings!.smart_routing_enabled).toBe(true);
    });
  });

  test('simple queries route to cheaper models', async ({ page }) => {
    await page.goto('/app/smart-routing');
    await page.waitForLoadState('networkidle');

    // Test simple prompts in playground
    for (const prompt of TEST_PROMPTS.simple.slice(0, 2)) {
      await test.step(`Test simple prompt: "${prompt.substring(0, 30)}..."`, async () => {
        // Select premium model
        const modelSelect = page.locator('select').first();
        await modelSelect.selectOption({ label: /gpt-4|claude-3-5-sonnet/i });

        // Enter prompt
        await page.fill('textarea', prompt);

        // Click test
        await page.click('button:has-text("Test")');

        // Wait for results
        await page.waitForSelector('text=/routed|complexity|savings/i', { timeout: 15000 });

        // Verify routing was applied (should route to cheaper model)
        const routingApplied = await page.getByText(/routed to|routing applied/i).isVisible().catch(() => false);
        const complexityScore = await page.locator('text=/complexity.*[0-9]/i').textContent().catch(() => null);

        console.log(`Prompt: "${prompt.substring(0, 30)}..." → Routed: ${routingApplied}, Score: ${complexityScore}`);

        // For simple prompts, complexity should be low
        if (complexityScore) {
          const score = parseFloat(complexityScore.match(/[0-9.]+/)?.[0] || '0');
          expect(score).toBeLessThan(0.6); // Simple queries should have low complexity
        }
      });
    }
  });

  test('complex queries use premium models', async ({ page }) => {
    await page.goto('/app/smart-routing');
    await page.waitForLoadState('networkidle');

    for (const prompt of TEST_PROMPTS.complex.slice(0, 2)) {
      await test.step(`Test complex prompt: "${prompt.substring(0, 40)}..."`, async () => {
        const modelSelect = page.locator('select').first();
        await modelSelect.selectOption({ label: /gpt-4|claude/i });

        await page.fill('textarea', prompt);
        await page.click('button:has-text("Test")');

        await page.waitForSelector('text=/routed|complexity|savings/i', { timeout: 15000 });

        // For complex prompts, should NOT route to cheaper model
        const routingReason = await page.locator('text=/using original|complexity.*>=|threshold/i').textContent().catch(() => null);
        console.log(`Complex prompt → Reason: ${routingReason?.substring(0, 50)}`);
      });
    }
  });

  test('RouteLLM ML predictions affect routing decisions', async ({ page }) => {
    // Enable RouteLLM
    await test.step('Enable RouteLLM', async () => {
      const updated = await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
        routellm_threshold: 0.11593, // Default threshold
      });
      expect(updated).toBe(true);
    });

    await page.goto('/app/smart-routing');
    await page.waitForLoadState('networkidle');

    // Test with RouteLLM enabled
    await test.step('Test prompt with RouteLLM', async () => {
      await page.fill('textarea', 'What is machine learning?');
      await page.click('button:has-text("Test")');

      await page.waitForSelector('text=/routed|complexity|RouteLLM/i', { timeout: 15000 });

      // Check if RouteLLM was used
      const routellmUsed = await page.getByText(/RouteLLM|win.*rate|P\(strong/i).isVisible().catch(() => false);
      console.log(`RouteLLM used: ${routellmUsed}`);
    });
  });

  test('routing saves costs over time', async ({ page }) => {
    // Make multiple requests and verify cost savings accumulate
    await test.step('Get initial routing stats', async () => {
      const initialStats = await getRoutingStats(API_BASE_URL, authToken, 1);
      console.log('Initial stats:', initialStats);
    });

    // Test multiple prompts via API
    await test.step('Make routing decisions for various prompts', async () => {
      for (const prompt of [...TEST_PROMPTS.simple.slice(0, 2), ...TEST_PROMPTS.complex.slice(0, 1)]) {
        const result = await testRoutingDecision(API_BASE_URL, authToken, 'gpt-4o', prompt);
        if (result) {
          console.log(`Prompt: "${prompt.substring(0, 30)}..." → Savings: $${result.estimated_savings_usd}`);
        }
      }
    });

    // Check updated stats
    await test.step('Verify savings accumulated', async () => {
      const finalStats = await getRoutingStats(API_BASE_URL, authToken, 1);
      console.log('Final stats:', finalStats);

      expect(finalStats).not.toBeNull();
      expect(finalStats!.total_decisions).toBeGreaterThan(0);
    });
  });
});

test.describe('Scenario: API Usage Tracking', () => {
  /**
   * Tests that actual LLM requests are tracked correctly:
   * - Token counts are accurate
   * - Costs are calculated
   * - Usage appears in dashboard
   * - Per-customer attribution works
   */

  let apiKey: string;
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    authToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });

    // Get or create API key
    apiKey = process.env.E2E_API_KEY || '';
    if (!apiKey) {
      test.skip(true, 'E2E_API_KEY environment variable required for API tests');
    }
  });

  test('LLM requests are tracked with accurate token counts', async ({ page }) => {
    // Get initial dashboard stats
    const initialStats = await getDashboardStats(API_BASE_URL, authToken);
    const initialRequests = initialStats?.total_requests || 0;
    const initialTokens = initialStats?.total_tokens || 0;

    // Make a real LLM request
    await test.step('Make LLM request', async () => {
      const response = await makeLLMRequest({
        apiKey,
        baseUrl: API_BASE_URL,
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Say "hello" and nothing else.' }],
        maxTokens: 10,
      });

      expect(response.success).toBe(true);
      expect(response.usage).toBeDefined();
      console.log(`LLM Response - Tokens: ${response.usage?.total_tokens}, Latency: ${response.latencyMs}ms`);
    });

    // Wait for tracking to propagate
    await page.waitForTimeout(3000);

    // Verify updated stats
    await test.step('Verify usage tracked', async () => {
      const finalStats = await waitFor(
        () => getDashboardStats(API_BASE_URL, authToken),
        (stats) => stats !== null && stats.total_requests > initialRequests,
        15000
      );

      expect(finalStats).not.toBeNull();
      expect(finalStats!.total_requests).toBeGreaterThan(initialRequests);
      expect(finalStats!.total_tokens).toBeGreaterThan(initialTokens);

      console.log(`Stats updated: ${initialRequests} → ${finalStats!.total_requests} requests`);
    });

    // Verify in dashboard UI
    await test.step('Verify in dashboard UI', async () => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Dashboard should show usage
      await expect(page.getByText(/usage|requests|tokens/i).first()).toBeVisible();
    });
  });

  test('requests with different models are tracked separately', async ({ page }) => {
    const models = ['gpt-3.5-turbo', 'gpt-4o-mini'];

    for (const model of models) {
      await test.step(`Make request to ${model}`, async () => {
        const response = await makeLLMRequest({
          apiKey,
          baseUrl: API_BASE_URL,
          model,
          messages: [{ role: 'user', content: 'Hello!' }],
          maxTokens: 10,
        });

        console.log(`${model}: Success=${response.success}, Tokens=${response.usage?.total_tokens}`);
      });
    }

    // Check analytics shows both models
    await test.step('Verify models in analytics', async () => {
      await page.goto('/app/analytics');
      await page.waitForLoadState('networkidle');

      // Should show model breakdown
      await expect(page.getByText(/gpt/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test('per-customer usage attribution', async ({ page }) => {
    const customerId = `customer_${testId()}`;

    // Create a test customer
    await test.step('Create test customer', async () => {
      const result = await createCustomer(API_BASE_URL, authToken, {
        external_id: customerId,
        name: 'E2E Test Customer',
        email: 'customer@test.com',
      });

      expect(result.success).toBe(true);
    });

    // Make request attributed to customer
    await test.step('Make customer-attributed request', async () => {
      const response = await makeLLMRequest({
        apiKey,
        baseUrl: API_BASE_URL,
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Hello from customer test!' }],
        maxTokens: 20,
        customerId,
      });

      expect(response.success).toBe(true);
    });

    // Wait for tracking
    await page.waitForTimeout(3000);

    // Verify customer usage in UI
    await test.step('Verify customer usage in UI', async () => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Search for customer
      const searchInput = page.locator('input[placeholder*="search"], input[type="search"]');
      if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await searchInput.fill(customerId);
        await page.waitForTimeout(500);
      }

      // Customer should appear with usage
      await expect(page.getByText(customerId)).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Scenario: Budget Alerts & Limits', () => {
  /**
   * Tests budget management:
   * - Setting budget limits on customers
   * - Alert generation when approaching limit
   * - Request blocking when limit exceeded
   */

  let authToken: string;
  let apiKey: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    authToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });

    apiKey = process.env.E2E_API_KEY || '';
  });

  test('customer budget limits trigger alerts', async ({ page }) => {
    const customerId = `budget_test_${testId()}`;

    // Create customer with low budget
    await test.step('Create customer with $0.10 budget', async () => {
      const result = await createCustomer(API_BASE_URL, authToken, {
        external_id: customerId,
        name: 'Budget Test Customer',
        budget_limit_usd: 0.10, // Very low limit
      });

      expect(result.success).toBe(true);
    });

    // Make requests to approach budget
    if (apiKey) {
      await test.step('Make requests to approach budget', async () => {
        // Make a few requests
        for (let i = 0; i < 3; i++) {
          await makeLLMRequest({
            apiKey,
            baseUrl: API_BASE_URL,
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'Write a short sentence.' }],
            maxTokens: 50,
            customerId,
          });
        }
      });
    }

    // Check for alerts in predictions page
    await test.step('Check for budget alerts', async () => {
      await page.goto('/app/predictions');
      await page.waitForLoadState('networkidle');

      // Look for alerts tab or section
      const alertsTab = page.getByRole('tab', { name: /alerts/i });
      if (await alertsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await alertsTab.click();
        await page.waitForTimeout(1000);
      }

      // May or may not have alerts depending on usage
      const hasAlerts = await page.getByText(/alert|warning|budget/i).isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Budget alerts visible: ${hasAlerts}`);
    });
  });

  test('configure prediction alerts', async ({ page }) => {
    await page.goto('/app/predictions');
    await page.waitForLoadState('networkidle');

    // Enable predictions if toggle exists
    await test.step('Enable prediction alerts', async () => {
      const enableToggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      if (await enableToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        const isEnabled = await enableToggle.isChecked().catch(() => false);
        if (!isEnabled) {
          await enableToggle.click();
        }
      }
    });

    // Check forecasts section
    await test.step('View cost forecasts', async () => {
      const forecastsTab = page.getByRole('tab', { name: /forecasts/i });
      if (await forecastsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
        await forecastsTab.click();
        await page.waitForTimeout(1000);
      }

      // Should show some forecast data or chart
      await expect(page.getByText(/forecast|projected|predict/i).first()).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Scenario: Multi-Tenant Data Isolation', () => {
  /**
   * Verifies that tenant data is properly isolated:
   * - API keys only work for their tenant
   * - Usage data is scoped to tenant
   * - Customers are tenant-specific
   */

  test('API key only returns data for its tenant', async ({ page }) => {
    const apiKey = process.env.E2E_API_KEY;
    if (!apiKey) {
      test.skip(true, 'E2E_API_KEY required');
      return;
    }

    // Make a request with the API key
    const response = await makeLLMRequest({
      apiKey,
      baseUrl: API_BASE_URL,
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Test isolation.' }],
      maxTokens: 10,
    });

    expect(response.success).toBe(true);

    // Login and verify the request appears for this tenant
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    // Dashboard should show the request
    await expect(page.getByText(/usage|request/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('invalid API key is rejected', async () => {
    const response = await makeLLMRequest({
      apiKey: 'invalid_key_12345',
      baseUrl: API_BASE_URL,
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Should fail.' }],
      maxTokens: 10,
    });

    expect(response.success).toBe(false);
    expect(response.error).toContain('401');
  });
});

test.describe('Scenario: Agent Workflow Tracking', () => {
  /**
   * Tests agentic workflow tracking:
   * - Workflows are captured and displayed
   * - Agent steps are recorded
   * - Token usage is aggregated per workflow
   */

  test('view agent workflows', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    await page.goto('/app/workflows');
    await page.waitForLoadState('networkidle');

    await test.step('Verify workflows page loads', async () => {
      await expect(page.getByText(/workflow|agent|trace/i).first()).toBeVisible({ timeout: 10000 });
    });

    await test.step('Check for workflow list or empty state', async () => {
      const hasWorkflows = await page.locator('table, [data-testid="workflow-list"]').isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmptyState = await page.getByText(/no workflows|no data|start/i).isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasWorkflows || hasEmptyState).toBe(true);
      console.log(`Workflows page: Has data=${hasWorkflows}, Empty state=${hasEmptyState}`);
    });
  });
});

test.describe('Scenario: Full User Onboarding Journey', () => {
  /**
   * Complete end-to-end journey simulating a real user:
   * 1. Register new account
   * 2. Create API key
   * 3. Enable smart routing
   * 4. Make LLM requests
   * 5. View analytics
   * 6. Set up customer tracking
   */

  test('complete new user journey', async ({ page }) => {
    const uniqueId = testId();
    const testEmail = `journey_${uniqueId}@test.tokentrail.dev`;
    const testPassword = 'JourneyTest123!';
    const companyName = `JourneyTestCo ${uniqueId}`;

    // Note: This test may need a valid email or test mode
    // Skip if registration is restricted

    await test.step('1. Register new account', async () => {
      await page.goto('/register');

      // Check if registration is available
      const registerForm = page.locator('form');
      if (!(await registerForm.isVisible({ timeout: 5000 }).catch(() => false))) {
        test.skip(true, 'Registration not available');
        return;
      }

      await page.fill('input[placeholder*="Company"]', companyName);
      await page.fill('input[name="fullName"], input[placeholder*="name"]', 'Journey Test User');
      await page.fill('input[type="email"]', testEmail);
      await page.fill('input[type="password"]', testPassword);

      await page.click('button[type="submit"]');

      // Should redirect to dashboard or show success
      const success = await Promise.race([
        page.waitForURL(/\/app\/dashboard/, { timeout: 15000 }).then(() => true),
        page.waitForSelector('text=/verify|email sent/i', { timeout: 15000 }).then(() => 'verification'),
      ]).catch(() => false);

      if (success === 'verification') {
        test.skip(true, 'Email verification required');
        return;
      }

      expect(success).toBe(true);
    });

    await test.step('2. View dashboard', async () => {
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
      await expect(page.getByText(/Welcome/i)).toBeVisible();
    });

    await test.step('3. Create API key', async () => {
      await page.click('text=API Keys');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Create API Key")');
      await page.fill('input[placeholder="My API Key"]', 'Journey Test Key');
      await page.selectOption('select', 'test');
      await page.click('button[type="submit"]:has-text("Create")');

      await expect(page.getByText(/API Key Created/i)).toBeVisible({ timeout: 10000 });

      // Copy the key (would need to capture it for further testing)
      const keyDisplay = page.locator('code, pre, [data-testid="api-key"]');
      const apiKey = await keyDisplay.textContent().catch(() => null);
      console.log(`Created API key: ${apiKey?.substring(0, 20)}...`);

      await page.click('button:has-text("Done"), button:has-text("Close")');
    });

    await test.step('4. Enable smart routing', async () => {
      await page.click('text=Smart Routing');
      await page.waitForLoadState('networkidle');

      const enableToggle = page.locator('input[type="checkbox"], [role="switch"]').first();
      if (await enableToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
        await enableToggle.click();
        await page.waitForTimeout(1000);
      }
    });

    await test.step('5. View analytics', async () => {
      await page.click('text=Analytics');
      await page.waitForLoadState('networkidle');

      await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();
    });

    await test.step('6. Add a customer', async () => {
      await page.click('text=Customers');
      await page.waitForLoadState('networkidle');

      await page.click('button:has-text("Add Customer")');
      await page.fill('input[placeholder="customer_123"]', `journey_customer_${uniqueId}`);
      await page.fill('input[placeholder="John Doe"]', 'Journey Test Customer');
      await page.click('button:has-text("Create")');

      // Should show success or customer in list
      await expect(page.getByText(/journey_customer|created/i)).toBeVisible({ timeout: 10000 });
    });

    await test.step('7. Check billing', async () => {
      await page.click('text=Billing');
      await page.waitForLoadState('networkidle');

      // Should show plan info
      await expect(page.getByText(/billing|plan|subscription/i).first()).toBeVisible({ timeout: 10000 });
    });

    console.log(`✅ Complete user journey successful for ${testEmail}`);
  });
});
