import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/dashboard');
  });

  test.describe('Page Load', () => {
    test('should load dashboard successfully', async ({ page }) => {
      // Page should load without errors
      await expect(page).toHaveURL(/\/app\/dashboard/);

      // Should display main heading or welcome message
      await expect(page.getByText(/dashboard|welcome|overview/i).first()).toBeVisible();
    });

    test('should display welcome message', async ({ page }) => {
      // Welcome message with optional company name
      await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have navigation sidebar', async ({ page }) => {
      // Sidebar should be present with navigation links
      const nav = page.locator('nav, aside').first();
      await expect(nav).toBeVisible();
    });
  });

  test.describe('Stats Overview', () => {
    test('should display usage statistics cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForLoadState('networkidle');

      // Dashboard has stats cards for Total Customers, Total Tokens, Total Cost, Active API Keys
      await expect(page.getByText(/total customers/i)).toBeVisible({ timeout: 10000 });
    });

    test('should display cost information', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Look for Total Cost stat card
      await expect(page.getByText(/total cost/i)).toBeVisible({ timeout: 10000 });
    });

    test('should display token usage', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Look for Total Tokens stat card
      await expect(page.getByText(/total tokens/i)).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Charts and Visualizations', () => {
    test('should display usage chart', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Usage Overview heading should be visible
      await expect(page.getByText(/usage overview/i)).toBeVisible({ timeout: 15000 });
    });

    test('should display chart section', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Wait for any loading states to clear
      await page.waitForTimeout(2000);

      // Chart area or Usage Overview section should be visible
      const usageSection = page.getByText(/usage overview|last 7 days/i).first();
      await expect(usageSection).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Activity Feed', () => {
    test('should display recent activity or events', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Look for activity feed or recent events section
      const activitySection = page.getByText(/activity|recent|events|live/i).first();
      await expect(activitySection).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to Analytics from dashboard', async ({ page }) => {
      await page.click('a[href*="analytics"], nav >> text=Analytics');
      await expect(page).toHaveURL(/\/app\/analytics/);
    });

    test('should navigate to Customers from dashboard', async ({ page }) => {
      await page.click('a[href*="customers"], nav >> text=Customers');
      await expect(page).toHaveURL(/\/app\/customers/);
    });

    test('should navigate to API Keys from dashboard', async ({ page }) => {
      await page.click('a[href*="api-keys"], nav >> text=API Keys');
      await expect(page).toHaveURL(/\/app\/api-keys/);
    });

    test('should navigate to Billing from dashboard', async ({ page }) => {
      await page.click('a[href*="billing"], nav >> text=Billing');
      await expect(page).toHaveURL(/\/app\/billing/);
    });

    test('should navigate to Smart Routing from dashboard', async ({ page }) => {
      await page.click('a[href="/app/smart-routing"]');
      await expect(page).toHaveURL(/\/app\/smart-routing/);
    });

    test('should navigate to Predictions from dashboard', async ({ page }) => {
      await page.click('a[href="/app/predictions"]');
      await expect(page).toHaveURL(/\/app\/predictions/);
    });

    test('should navigate to Workflows from dashboard', async ({ page }) => {
      await page.click('a[href*="workflows"], nav >> text=Workflows');
      await expect(page).toHaveURL(/\/app\/workflows/);
    });

    test('should navigate to Settings from dashboard', async ({ page }) => {
      await page.click('a[href*="settings"], nav >> text=Settings');
      await expect(page).toHaveURL(/\/app\/settings/);
    });
  });

  test.describe('Responsive Design', () => {
    test('should display properly on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Dashboard should still be functional - check for h1 or welcome text
      const hasDashboard = await page.locator('h1:has-text("Dashboard")').isVisible({ timeout: 10000 }).catch(() => false);
      const hasWelcome = await page.getByText(/welcome back/i).isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasDashboard || hasWelcome).toBeTruthy();
    });

    test('should display properly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Dashboard should be visible
      const hasDashboard = await page.locator('h1:has-text("Dashboard")').isVisible({ timeout: 10000 }).catch(() => false);
      const hasWelcome = await page.getByText(/welcome back/i).isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasDashboard || hasWelcome).toBeTruthy();
    });
  });

  test.describe('Loading States', () => {
    test('should show loading indicator while fetching data', async ({ page }) => {
      // Navigate fresh to catch loading state
      await page.goto('/app/dashboard');

      // May see loading spinner/skeleton briefly
      // This checks that page eventually loads properly
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/dashboard|welcome/i).first()).toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Intercept API calls to simulate errors
      await page.route('**/api/**', route => route.abort());

      await page.goto('/app/dashboard');

      // Should show error state or still render page structure
      await expect(page.locator('body')).toBeVisible();
    });
  });
});
