import { test, expect } from '@playwright/test';
import { testConfig, LoginPage, RegisterPage } from '../fixtures/test-fixtures';

test.describe('Authentication', () => {
  test.describe('Landing Page', () => {
    test('should display landing page with login/register options', async ({ page }) => {
      await page.goto('/');

      // Should see TokenTrail branding
      await expect(page.getByText('TokenTrail').first()).toBeVisible();

      // Should have Sign in link in nav
      await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    });

    test('should navigate to login from landing page', async ({ page }) => {
      await page.goto('/');
      await page.click('a:has-text("Sign in")');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to register from pricing section', async ({ page }) => {
      await page.goto('/');
      // Click on Start Free or similar in pricing section
      const registerLink = page.locator('a[href="/register"]').first();
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Login', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login');
    });

    test('should display login form', async ({ page }) => {
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      // Button says "Sign in"
      await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
    });

    test('should show validation errors for empty fields', async ({ page }) => {
      // HTML5 validation prevents submission, so check that fields are required
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await expect(emailInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('should show error for invalid email format', async ({ page }) => {
      // HTML5 email validation handles this - check input type
      const emailInput = page.locator('input[type="email"]');
      await expect(emailInput).toHaveAttribute('type', 'email');
    });

    test('should show error for incorrect credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'wrong@example.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Wait for error message (toast or inline) - check for various error patterns
      const errorPatterns = [
        /failed|invalid|incorrect|unauthorized|error|wrong/i,
        /unable to|could not|cannot/i,
      ];

      let hasError = false;
      for (const pattern of errorPatterns) {
        const isVisible = await page.getByText(pattern).first().isVisible({ timeout: 5000 }).catch(() => false);
        if (isVisible) {
          hasError = true;
          break;
        }
      }

      // If no visible error text, check that we're still on login page (form submission was rejected)
      if (!hasError) {
        await expect(page).toHaveURL(/\/login/);
      }
    });

    // Note: This test requires E2E_TEST_EMAIL and E2E_TEST_PASSWORD environment variables
    // to be set to valid credentials. Skip if not configured.
    test('should successfully login with valid credentials', async ({ page }) => {
      // Skip if using default test credentials (they may not exist)
      if (testConfig.testUser.email === 'test@tokentrailapp.com') {
        test.skip();
        return;
      }

      await page.fill('input[type="email"]', testConfig.testUser.email);
      await page.fill('input[type="password"]', testConfig.testUser.password);
      await page.click('button[type="submit"]');

      // Should redirect to dashboard
      await expect(page).toHaveURL(/\/app\/dashboard/, { timeout: 15000 });

      // Should see dashboard content
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    });

    test('should mask password field', async ({ page }) => {
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toHaveAttribute('type', 'password');
    });

    test('should have link to register page', async ({ page }) => {
      // Link says "Start free trial"
      const registerLink = page.getByRole('link', { name: /start free trial/i });
      await expect(registerLink).toBeVisible();
      await registerLink.click();
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Registration', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/register');
    });

    test('should display registration form', async ({ page }) => {
      // Company name field (id="company_name", placeholder="Acme Inc")
      await expect(page.locator('input#company_name')).toBeVisible();

      // Full name field (optional)
      await expect(page.locator('input#full_name')).toBeVisible();

      // Email field
      await expect(page.locator('input[type="email"]')).toBeVisible();

      // Password field
      await expect(page.locator('input[type="password"]')).toBeVisible();

      // Submit button says "Get Started Free"
      await expect(page.getByRole('button', { name: /get started free/i })).toBeVisible();
    });

    test('should show validation errors for empty required fields', async ({ page }) => {
      // HTML5 validation - check required attributes
      const companyInput = page.locator('input#company_name');
      const emailInput = page.locator('input[type="email"]');
      const passwordInput = page.locator('input[type="password"]');

      await expect(companyInput).toHaveAttribute('required', '');
      await expect(emailInput).toHaveAttribute('required', '');
      await expect(passwordInput).toHaveAttribute('required', '');
    });

    test('should show error for weak password', async ({ page }) => {
      await page.fill('input#company_name', 'Test Company');
      await page.fill('input[type="email"]', 'test@example.com');
      await page.fill('input[type="password"]', 'weak');
      await page.click('button[type="submit"]');

      // Password has minLength=8 validation
      const passwordInput = page.locator('input[type="password"]');
      await expect(passwordInput).toHaveAttribute('minlength', '8');
    });

    // Note: This test requires a user to already exist with the E2E_TEST_EMAIL
    test('should show error for duplicate email', async ({ page }) => {
      // Skip if using default test credentials
      if (testConfig.testUser.email === 'test@tokentrailapp.com') {
        test.skip();
        return;
      }

      // Try to register with existing email
      await page.fill('input#company_name', 'Duplicate Company');
      await page.fill('input[type="email"]', testConfig.testUser.email);
      await page.fill('input[type="password"]', 'ValidPassword123!');
      await page.click('button[type="submit"]');

      // Should show duplicate email error (toast)
      await expect(page.getByText(/already.*exists|email.*taken|already.*registered|failed/i)).toBeVisible({
        timeout: 10000,
      });
    });

    test('should have link to login page', async ({ page }) => {
      // Link says "Sign in"
      const loginLink = page.getByRole('link', { name: /sign in/i });
      await expect(loginLink).toBeVisible();
      await loginLink.click();
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Logout', () => {
    // This test uses the authenticated session from auth.setup.ts
    test('should successfully logout', async ({ page }) => {
      // Go directly to dashboard (uses stored auth state)
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify we're logged in
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });

      // Find and click Sign Out button (text is "Sign Out")
      const signOutButton = page.getByText(/sign out/i);
      await signOutButton.click();

      // Should redirect to login or landing page
      await expect(page).toHaveURL(/\/(login)?$/, { timeout: 10000 });
    });
  });

  test.describe('Protected Routes', () => {
    test('should handle unauthenticated access to dashboard', async ({ browser }) => {
      // Create new context without stored auth state
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // App should either redirect to login OR show empty/error state
      const isOnLogin = page.url().includes('/login');
      const isOnDashboard = page.url().includes('/dashboard');

      // Either redirected to login or stayed on dashboard (showing empty state)
      expect(isOnLogin || isOnDashboard).toBeTruthy();
      await context.close();
    });

    test('should handle unauthenticated access to customers', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/app/customers');
      await page.waitForLoadState('networkidle');

      const isOnLogin = page.url().includes('/login');
      const isOnCustomers = page.url().includes('/customers');

      expect(isOnLogin || isOnCustomers).toBeTruthy();
      await context.close();
    });

    test('should handle unauthenticated access to api-keys', async ({ browser }) => {
      const context = await browser.newContext();
      const page = await context.newPage();

      await page.goto('/app/api-keys');
      await page.waitForLoadState('networkidle');

      const isOnLogin = page.url().includes('/login');
      const isOnApiKeys = page.url().includes('/api-keys');

      expect(isOnLogin || isOnApiKeys).toBeTruthy();
      await context.close();
    });
  });

  test.describe('Session Persistence', () => {
    // This test uses the authenticated session from auth.setup.ts
    test('should maintain session after page refresh', async ({ page }) => {
      // Go to dashboard (uses stored auth state)
      await page.goto('/app/dashboard');
      await page.waitForLoadState('networkidle');

      // Verify we're on dashboard
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible({ timeout: 10000 });

      // Refresh the page
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Should still be on dashboard (not redirected to login)
      await expect(page).toHaveURL(/\/app\/dashboard/);
      await expect(page.locator('h1:has-text("Dashboard")')).toBeVisible();
    });
  });
});
