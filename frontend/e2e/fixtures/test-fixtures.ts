import { test as base, expect, Page } from '@playwright/test';

/**
 * Test configuration and credentials
 */
export const testConfig = {
  baseURL: process.env.E2E_BASE_URL || 'https://tokentrailapp.com',
  testUser: {
    email: process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com',
    password: process.env.E2E_TEST_PASSWORD || 'TestPassword123!',
    companyName: process.env.E2E_TEST_COMPANY || 'E2E Test Company',
  },
  timeouts: {
    short: 5000,
    medium: 10000,
    long: 30000,
  },
};

/**
 * Custom test fixtures for TokenTrail
 */
export interface TestFixtures {
  authenticatedPage: Page;
}

/**
 * Page Object Models
 */
export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(email: string, password: string) {
    await this.page.fill('input[type="email"]', email);
    await this.page.fill('input[type="password"]', password);
    await this.page.click('button[type="submit"]');
  }

  async expectError(message: string) {
    await expect(this.page.getByText(message)).toBeVisible();
  }

  async expectLoginSuccess() {
    await expect(this.page).toHaveURL(/\/app\/dashboard/);
  }
}

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
  }

  async register(data: {
    companyName: string;
    fullName?: string;
    email: string;
    password: string;
  }) {
    await this.page.fill('input[name="companyName"], input[placeholder*="Company"]', data.companyName);
    if (data.fullName) {
      await this.page.fill('input[name="fullName"], input[placeholder*="name"]', data.fullName);
    }
    await this.page.fill('input[type="email"]', data.email);
    await this.page.fill('input[type="password"]', data.password);
    await this.page.click('button[type="submit"]');
  }

  async expectRegistrationSuccess() {
    await expect(this.page).toHaveURL(/\/app\/dashboard/);
  }
}

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/dashboard');
  }

  async expectLoaded() {
    await expect(this.page.getByText(/dashboard|welcome|overview/i)).toBeVisible();
  }

  async getUsageStats() {
    return {
      totalCost: await this.page.locator('[data-testid="total-cost"]').textContent(),
      totalTokens: await this.page.locator('[data-testid="total-tokens"]').textContent(),
      totalRequests: await this.page.locator('[data-testid="total-requests"]').textContent(),
    };
  }
}

export class CustomersPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/customers');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /customers/i })).toBeVisible();
  }

  async clickAddCustomer() {
    await this.page.click('button:has-text("Add Customer")');
  }

  async fillCustomerForm(data: {
    externalId: string;
    name?: string;
    email?: string;
    budgetLimit?: number;
  }) {
    await this.page.fill('input[name="external_id"], input[placeholder*="external"]', data.externalId);
    if (data.name) {
      await this.page.fill('input[name="name"], input[placeholder*="name"]', data.name);
    }
    if (data.email) {
      await this.page.fill('input[name="email"], input[placeholder*="email"]', data.email);
    }
    if (data.budgetLimit) {
      await this.page.fill('input[name="budget_limit_usd"], input[placeholder*="budget"]', String(data.budgetLimit));
    }
  }

  async submitCustomerForm() {
    await this.page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Save")');
  }

  async expectCustomerInList(name: string) {
    await expect(this.page.getByText(name)).toBeVisible();
  }

  async deleteCustomer(externalId: string) {
    const row = this.page.locator(`tr:has-text("${externalId}")`);
    await row.locator('button[aria-label="Delete"], button:has-text("Delete")').click();
    await this.page.click('button:has-text("Confirm"), button:has-text("Yes")');
  }
}

export class ApiKeysPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/api-keys');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /api keys/i })).toBeVisible();
  }

  async clickCreateKey() {
    await this.page.click('button:has-text("Create")');
  }

  async createKey(name: string, environment: 'production' | 'test' = 'test') {
    await this.clickCreateKey();
    await this.page.fill('input[name="name"], input[placeholder*="name"]', name);
    await this.page.click(`label:has-text("${environment}"), button:has-text("${environment}")`);
    await this.page.click('button[type="submit"]:has-text("Create"), button[type="submit"]:has-text("Generate")');
  }

  async expectKeyCreated() {
    await expect(this.page.getByText(/key created|copy.*key/i)).toBeVisible();
  }

  async copyKeyToClipboard() {
    await this.page.click('button:has-text("Copy")');
  }
}

export class BillingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/billing');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /billing|subscription/i })).toBeVisible();
  }

  async getCurrentPlan() {
    return this.page.locator('[data-testid="current-plan"], .current-plan').textContent();
  }

  async selectPlan(planName: string) {
    await this.page.click(`button:has-text("${planName}")`);
  }
}

export class SmartRoutingPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/smart-routing');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /smart routing/i })).toBeVisible();
  }

  async toggleRouting(enabled: boolean) {
    const toggle = this.page.locator('input[type="checkbox"], [role="switch"]').first();
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async testRouting(model: string, prompt: string) {
    await this.page.selectOption('select', { label: model });
    await this.page.fill('textarea', prompt);
    await this.page.click('button:has-text("Test")');
  }

  async expectTestResults() {
    await expect(this.page.getByText(/routed|complexity|savings/i)).toBeVisible();
  }
}

export class PredictionsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/predictions');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /predictions|budget.*alerts/i })).toBeVisible();
  }

  async togglePredictions(enabled: boolean) {
    const toggle = this.page.locator('input[type="checkbox"], [role="switch"]').first();
    const isChecked = await toggle.isChecked();
    if (isChecked !== enabled) {
      await toggle.click();
    }
  }

  async goToForecastsTab() {
    await this.page.click('button:has-text("Forecasts"), [role="tab"]:has-text("Forecasts")');
  }

  async goToAlertsTab() {
    await this.page.click('button:has-text("Alerts"), [role="tab"]:has-text("Alerts")');
  }
}

export class WorkflowsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/workflows');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /workflows|agentic/i })).toBeVisible();
  }

  async goToWorkflowsTab() {
    await this.page.click('button:has-text("Workflows"), [role="tab"]:has-text("Workflows")');
  }

  async goToAgentsTab() {
    await this.page.click('button:has-text("Agents"), [role="tab"]:has-text("Agents")');
  }

  async clickWorkflow(workflowId: string) {
    await this.page.click(`tr:has-text("${workflowId}")`);
  }

  async expectWorkflowModal() {
    await expect(this.page.locator('[role="dialog"], .modal')).toBeVisible();
  }
}

export class AnalyticsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/analytics');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /analytics/i })).toBeVisible();
  }

  async expectChartsLoaded() {
    // Wait for charts to render
    await expect(this.page.locator('canvas, svg').first()).toBeVisible();
  }
}

export class SettingsPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/app/settings');
  }

  async expectLoaded() {
    await expect(this.page.getByRole('heading', { name: /settings/i })).toBeVisible();
  }

  async getProfileInfo() {
    return {
      email: await this.page.locator('[data-testid="user-email"]').textContent(),
      company: await this.page.locator('[data-testid="company-name"]').textContent(),
    };
  }
}

/**
 * Navigation helper
 */
export class Navigation {
  constructor(private page: Page) {}

  async goToDashboard() {
    await this.page.click('a[href*="dashboard"], nav >> text=Dashboard');
  }

  async goToAnalytics() {
    await this.page.click('a[href*="analytics"], nav >> text=Analytics');
  }

  async goToCustomers() {
    await this.page.click('a[href*="customers"], nav >> text=Customers');
  }

  async goToApiKeys() {
    await this.page.click('a[href*="api-keys"], nav >> text=API Keys');
  }

  async goToBilling() {
    await this.page.click('a[href*="billing"], nav >> text=Billing');
  }

  async goToSmartRouting() {
    await this.page.click('a[href*="smart-routing"], nav >> text=Smart Routing');
  }

  async goToPredictions() {
    await this.page.click('a[href*="predictions"], nav >> text=Predictions');
  }

  async goToWorkflows() {
    await this.page.click('a[href*="workflows"], nav >> text=Workflows');
  }

  async goToSettings() {
    await this.page.click('a[href*="settings"], nav >> text=Settings');
  }

  async logout() {
    await this.page.click('button:has-text("Logout"), a:has-text("Logout"), text=Sign out');
  }
}

/**
 * Extended test with fixtures
 */
export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login');
    await page.fill('input[type="email"]', testConfig.testUser.email);
    await page.fill('input[type="password"]', testConfig.testUser.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);
    await use(page);
  },
});

export { expect };
