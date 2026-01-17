import { test, expect } from '@playwright/test';
import { registerUser, login, navigateTo } from './helpers';

test.describe('App Navigation', () => {
  let user: { email: string; password: string; company: string; token: string };

  test.beforeAll(async ({ browser }) => {
    // Register a user before all tests
    const page = await browser.newPage();
    user = await registerUser(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await login(page, user.email, user.password);
  });

  test.describe('Sidebar Navigation', () => {
    test('should display sidebar with logo', async ({ page }) => {
      await expect(page.locator('text=UsageFlow')).toBeVisible();
    });

    test('should display Overview section with navigation items', async ({ page }) => {
      await expect(page.locator('text=Overview')).toBeVisible();

      // Main navigation items
      const mainNavItems = ['Dashboard', 'Analytics', 'Smart Routing', 'Predictions', 'Workflows', 'Agent Efficiency'];
      for (const item of mainNavItems) {
        await expect(page.locator(`nav a:has-text("${item}")`)).toBeVisible();
      }
    });

    test('should display Manage section with navigation items', async ({ page }) => {
      await expect(page.locator('text=Manage')).toBeVisible();

      // Manage navigation items
      const manageNavItems = ['Customers', 'API Keys', 'Billing', 'Settings'];
      for (const item of manageNavItems) {
        await expect(page.locator(`nav a:has-text("${item}")`)).toBeVisible();
      }
    });

    test('should display system status indicator', async ({ page }) => {
      await expect(page.locator('text=System Online')).toBeVisible();
    });
  });

  test.describe('Main Navigation Routes', () => {
    test('should navigate to Dashboard', async ({ page }) => {
      await navigateTo(page, 'Dashboard');
      await expect(page).toHaveURL(/dashboard/);
    });

    test('should navigate to Analytics', async ({ page }) => {
      await navigateTo(page, 'Analytics');
      await expect(page).toHaveURL(/analytics/);
    });

    test('should navigate to Smart Routing', async ({ page }) => {
      await navigateTo(page, 'Smart Routing');
      await expect(page).toHaveURL(/smart-routing/);
    });

    test('should navigate to Predictions', async ({ page }) => {
      await navigateTo(page, 'Predictions');
      await expect(page).toHaveURL(/predictions/);
    });

    test('should navigate to Workflows', async ({ page }) => {
      await navigateTo(page, 'Workflows');
      await expect(page).toHaveURL(/workflows/);
    });

    test('should navigate to Agent Efficiency', async ({ page }) => {
      await navigateTo(page, 'Agent Efficiency');
      await expect(page).toHaveURL(/agent-efficiency/);
    });
  });

  test.describe('Manage Navigation Routes', () => {
    test('should navigate to Customers', async ({ page }) => {
      await navigateTo(page, 'Customers');
      await expect(page).toHaveURL(/customers/);
    });

    test('should navigate to API Keys', async ({ page }) => {
      await navigateTo(page, 'API Keys');
      await expect(page).toHaveURL(/api-keys/);
    });

    test('should navigate to Billing', async ({ page }) => {
      await navigateTo(page, 'Billing');
      await expect(page).toHaveURL(/billing/);
    });

    test('should navigate to Settings', async ({ page }) => {
      await navigateTo(page, 'Settings');
      await expect(page).toHaveURL(/settings/);
    });
  });

  test.describe('Active State', () => {
    test('should highlight active navigation item', async ({ page }) => {
      // Navigate to Analytics
      await navigateTo(page, 'Analytics');

      // Check that Analytics link has active styling
      const analyticsLink = page.locator('nav a:has-text("Analytics")');
      await expect(analyticsLink).toHaveClass(/bg-vscode-bgActive|border-vscode-blue/);
    });

    test('should show active indicator dot on current page', async ({ page }) => {
      await navigateTo(page, 'Customers');

      // The active nav item should have a pulsing dot
      const customersLink = page.locator('nav a:has-text("Customers")');
      const activeDot = customersLink.locator('.animate-pulse');
      await expect(activeDot).toBeVisible();
    });
  });

  test.describe('Page Content Verification', () => {
    test('Dashboard should show dashboard content', async ({ page }) => {
      await navigateTo(page, 'Dashboard');
      // Dashboard should have some recognizable content
      await expect(page.locator('h1:has-text("Dashboard"), h2:has-text("Dashboard"), text=Overview').first()).toBeVisible();
    });

    test('Customers page should show customer management', async ({ page }) => {
      await navigateTo(page, 'Customers');
      await expect(page.locator('text=/Customers|Add Customer|Customer List/i').first()).toBeVisible();
    });

    test('API Keys page should show key management', async ({ page }) => {
      await navigateTo(page, 'API Keys');
      await expect(page.locator('text=/API Key|Create|Generate/i').first()).toBeVisible();
    });
  });
});

test.describe('Protected Routes', () => {
  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    // Clear any existing auth state
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to access dashboard directly
    await page.goto('/app/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('should redirect to login when accessing customers without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/app/customers');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('should redirect to login when accessing analytics without auth', async ({ page }) => {
    await page.context().clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    await page.goto('/app/analytics');
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });
});

test.describe('Full User Journey', () => {
  test('should complete full navigation flow from landing to all pages', async ({ page }) => {
    // Start at landing page
    await page.goto('/');
    await expect(page.locator('text=LLM Billing')).toBeVisible();

    // Go to register
    await page.locator('nav a:has-text("Start Free")').click();
    await expect(page).toHaveURL(/register/);

    // Register new user
    const suffix = Math.random().toString(36).substring(2, 8);
    await page.fill('input[placeholder*="Acme"], input[name="company_name"]', `Journey Test ${suffix}`);
    await page.fill('input[type="email"]', `journey_${suffix}@test.com`);
    await page.fill('input[type="password"]', 'Test123!@#');
    await page.click('button[type="submit"]');

    // Should land on dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Navigate through all main pages
    const pages = [
      { name: 'Analytics', url: /analytics/ },
      { name: 'Smart Routing', url: /smart-routing/ },
      { name: 'Predictions', url: /predictions/ },
      { name: 'Workflows', url: /workflows/ },
      { name: 'Agent Efficiency', url: /agent-efficiency/ },
      { name: 'Customers', url: /customers/ },
      { name: 'API Keys', url: /api-keys/ },
      { name: 'Billing', url: /billing/ },
      { name: 'Settings', url: /settings/ },
      { name: 'Dashboard', url: /dashboard/ }, // Back to dashboard
    ];

    for (const pageInfo of pages) {
      await page.click(`nav a:has-text("${pageInfo.name}")`);
      await page.waitForLoadState('networkidle');
      await expect(page).toHaveURL(pageInfo.url);
    }
  });
});
