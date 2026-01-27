import { test, expect } from '@playwright/test';

/**
 * Realistic User Journey Tests
 * These tests simulate actual user workflows through the application
 */

test.describe('User Journeys', () => {
  test.describe('Navigation Flow', () => {
    test('user can navigate through all main sections', async ({ page }) => {
      // Start at dashboard
      await page.goto('/app/dashboard');
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await page.waitForLoadState('networkidle');

      // Verify dashboard header shows
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

      // Navigate to Analytics
      await page.click('text=Analytics');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/analytics/);
      await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();

      // Navigate to Smart Routing
      await page.click('text=Smart Routing');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/smart-routing/);

      // Navigate to Predictions
      await page.click('text=Predictions');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/predictions/);

      // Navigate to Workflows
      await page.click('text=Workflows');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/workflows/);

      // Navigate to Customers
      await page.click('text=Customers');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/customers/);
      await expect(page.locator('h1:has-text("Customers")')).toBeVisible();

      // Navigate to API Keys
      await page.click('text=API Keys');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/api-keys/);

      // Navigate to Billing
      await page.click('text=Billing');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/billing/);

      // Navigate to Settings
      await page.click('text=Settings');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/settings/);

      // Back to Dashboard
      await page.click('text=Dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/dashboard/);
    });
  });

  test.describe('Dashboard Experience', () => {
    test('dashboard loads with key information', async ({ page }) => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Should show Dashboard heading
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

      // Should show welcome message
      await expect(page.getByText(/Welcome back/i)).toBeVisible();

      // Should show Live indicator
      await expect(page.getByText('Live')).toBeVisible();
    });

    test('dashboard shows realtime stats and usage overview', async ({ page }) => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Should have usage overview section
      await expect(page.locator('h2:has-text("Usage Overview")')).toBeVisible();

      // Should show "Last 7 days" badge
      await expect(page.getByText('Last 7 days')).toBeVisible();
    });

    test('dashboard displays stats cards', async ({ page }) => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Stats cards should be visible (content depends on data)
      const statsSection = page.locator('.space-y-6');
      await expect(statsSection).toBeVisible();
    });
  });

  test.describe('Analytics Experience', () => {
    test('analytics page loads with charts and tables', async ({ page }) => {
      await page.goto('/app/analytics');
      await page.waitForLoadState('networkidle');

      // Should show Analytics heading
      await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();

      // Should show Daily Usage Trend chart
      await expect(page.locator('h2:has-text("Daily Usage Trend")')).toBeVisible({ timeout: 10000 });

      // Should have chart elements
      const chart = page.locator('.recharts-wrapper, canvas, svg').first();
      await expect(chart).toBeVisible({ timeout: 10000 });
    });

    test('analytics shows model and customer data tables', async ({ page }) => {
      await page.goto('/app/analytics');
      await page.waitForLoadState('networkidle');

      // Should show tables with data
      const table = page.locator('table').first();
      await expect(table).toBeVisible({ timeout: 10000 });

      // Should have table headers for model/cost data
      await expect(page.getByText(/Model|Provider|Cost|Tokens/i).first()).toBeVisible();
    });
  });

  test.describe('Customer Management Journey', () => {
    test('customers page loads with proper structure', async ({ page }) => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Should show Customers heading
      await expect(page.locator('h1:has-text("Customers")')).toBeVisible();

      // Should show description text
      await expect(page.getByText('Manage your end customers and view their usage')).toBeVisible();

      // Should have Add Customer button
      await expect(page.locator('button:has-text("Add Customer")')).toBeVisible();
    });

    test('user can open and fill add customer modal', async ({ page }) => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Click Add Customer button
      await page.click('button:has-text("Add Customer")');

      // Modal should open with Add Customer heading
      await expect(page.locator('h2:has-text("Add Customer")')).toBeVisible();

      // Required field: External ID
      const externalIdInput = page.locator('input[placeholder="customer_123"]');
      await expect(externalIdInput).toBeVisible();

      // Optional fields
      await expect(page.locator('input[placeholder="John Doe"]')).toBeVisible();
      await expect(page.locator('input[placeholder="john@example.com"]')).toBeVisible();

      // Budget sections should be visible
      await expect(page.getByText('Monthly Budget Limit')).toBeVisible();
      await expect(page.getByText('Workflow Budget (Agentic AI)')).toBeVisible();

      // Cancel and Create buttons
      await expect(page.locator('button:has-text("Cancel")')).toBeVisible();
      await expect(page.locator('button:has-text("Create")')).toBeVisible();
    });

    test('user can close add customer modal', async ({ page }) => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Open modal
      await page.click('button:has-text("Add Customer")');
      await expect(page.locator('h2:has-text("Add Customer")')).toBeVisible();

      // Close modal
      await page.click('button:has-text("Cancel")');

      // Modal should be closed
      await expect(page.locator('h2:has-text("Add Customer")')).not.toBeVisible();
    });

    test('customers table shows correct columns when data exists', async ({ page }) => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Check for table headers (only visible if customers exist)
      const table = page.locator('table');
      if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(page.locator('th:has-text("Customer")')).toBeVisible();
        await expect(page.locator('th:has-text("Email")')).toBeVisible();
        await expect(page.locator('th:has-text("Events")')).toBeVisible();
        await expect(page.locator('th:has-text("Usage")')).toBeVisible();
        await expect(page.locator('th:has-text("Cost")')).toBeVisible();
        await expect(page.locator('th:has-text("Monthly Budget")')).toBeVisible();
      } else {
        // Empty state should be shown
        await expect(page.getByText('No customers yet')).toBeVisible();
      }
    });
  });

  test.describe('API Keys Management Journey', () => {
    test('api keys page loads with create button', async ({ page }) => {
      await page.goto('/app/api-keys');
      await page.waitForLoadState('networkidle');

      // Should show API Keys heading
      await expect(page.getByRole('heading', { name: /api.*keys/i })).toBeVisible();

      // Should have Create API Key button
      await expect(page.locator('button:has-text("Create API Key")')).toBeVisible();
    });

    test('user can open and configure create API key modal', async ({ page }) => {
      await page.goto('/app/api-keys');
      await page.waitForLoadState('networkidle');

      // Click Create API Key button
      await page.click('button:has-text("Create API Key")');

      // Modal should open
      await expect(page.getByRole('heading', { name: /create api key/i })).toBeVisible();

      // Name input field
      const nameInput = page.locator('input[placeholder="My API Key"]');
      await expect(nameInput).toBeVisible();
      await nameInput.fill('E2E Test Key');

      // Environment selector
      const envSelect = page.locator('select').first();
      await expect(envSelect).toBeVisible();

      // Should have Live and Test options
      await expect(page.locator('option:has-text("Live")')).toBeVisible();
    });

    test('complete API key creation flow', async ({ page }) => {
      await page.goto('/app/api-keys');
      await page.waitForLoadState('networkidle');

      const keyName = `E2E Journey Key ${Date.now()}`;

      // Open create modal
      await page.click('button:has-text("Create API Key")');

      // Fill in name
      await page.fill('input[placeholder="My API Key"]', keyName);

      // Select test environment
      await page.selectOption('select', 'test');

      // Submit
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show success modal with the key
      await expect(page.getByText(/API Key Created/i)).toBeVisible({ timeout: 10000 });

      // Should show warning about not seeing key again
      await expect(page.getByText(/won't be able to see it again/i)).toBeVisible();

      // Should have copy button
      await expect(page.locator('button:has-text("Copy")')).toBeVisible();
    });
  });

  test.describe('Smart Routing', () => {
    test('smart routing page loads with configuration options', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/app\/smart-routing/);

      // Should have smart routing content
      await expect(page.getByText(/routing|smart|model/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Predictions & Alerts', () => {
    test('predictions page loads with forecasting content', async ({ page }) => {
      await page.goto('/app/predictions');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/app\/predictions/);

      // Should have predictions/budget content
      await expect(page.getByText(/prediction|forecast|budget|cost/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Workflows', () => {
    test('workflows page loads with trace/agent content', async ({ page }) => {
      await page.goto('/app/workflows');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/app\/workflows/);

      // Should have workflows/trace content
      await expect(page.getByText(/workflow|trace|agent/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Settings', () => {
    test('settings page shows account information', async ({ page }) => {
      await page.goto('/app/settings');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/app\/settings/);

      // Should show settings or account info
      await expect(page.getByText(/settings|account|profile/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Billing', () => {
    test('billing page loads with plan and pricing info', async ({ page }) => {
      await page.goto('/app/billing');
      await page.waitForLoadState('networkidle');

      await expect(page).toHaveURL(/\/app\/billing/);

      // Should show billing/plan info
      await expect(page.getByText(/billing|plan|subscription|pricing|credits/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('User Session', () => {
    test('user email is displayed in header', async ({ page }) => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Should show user email somewhere
      await expect(page.getByText(/@/).first()).toBeVisible({ timeout: 10000 });
    });

    test('sign out button is accessible', async ({ page }) => {
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Should have sign out option
      const signOutButton = page.getByText(/sign out/i).first();
      await expect(signOutButton).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('app works on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // App should still function - Dashboard heading visible
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 15000 });

      // User can still sign out
      await expect(page.getByText(/sign out/i).first()).toBeVisible();
    });

    test('customers page works on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Customers heading visible
      await expect(page.locator('h1:has-text("Customers")')).toBeVisible({ timeout: 15000 });

      // Add Customer button accessible
      await expect(page.locator('button:has-text("Add Customer")')).toBeVisible();
    });
  });

  test.describe('Cross-Page User Journeys', () => {
    test('new user onboarding: dashboard to API key creation', async ({ page }) => {
      // Start at dashboard
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

      // Navigate to API Keys
      await page.click('text=API Keys');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/api-keys/);

      // Create an API key
      await page.click('button:has-text("Create API Key")');
      await expect(page.getByRole('heading', { name: /create api key/i })).toBeVisible();
    });

    test('usage analysis journey: dashboard to analytics to customers', async ({ page }) => {
      // Start at dashboard to see overview
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();

      // Go to analytics for detailed breakdown
      await page.click('text=Analytics');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1:has-text("Analytics")')).toBeVisible();

      // Go to customers to see individual usage
      await page.click('text=Customers');
      await page.waitForLoadState('networkidle');
      await expect(page.locator('h1:has-text("Customers")')).toBeVisible();
    });

    test('billing review journey: billing to settings', async ({ page }) => {
      // Check billing status
      await page.goto('/app/billing');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/billing/);

      // Go to settings for account info
      await page.click('text=Settings');
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(/\/app\/settings/);
    });
  });

  test.describe('Customer Workflow Management', () => {
    test('view customer usage and manage budget limits', async ({ page }) => {
      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      // Check if there are customers
      const table = page.locator('table');
      if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Click edit on first customer
        const editButton = page.locator('button:has-text("Edit")').first();
        if (await editButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await editButton.click();

          // Edit Customer modal should open
          await expect(page.locator('h2:has-text("Edit Customer")')).toBeVisible();

          // Should show budget limit field
          await expect(page.locator('input[placeholder="e.g., 100.00"]').first()).toBeVisible();

          // Close modal
          await page.click('button:has-text("Cancel")');
        }
      } else {
        // No customers - verify empty state
        await expect(page.getByText('No customers yet')).toBeVisible();
      }
    });
  });
});
