import { test, expect } from '@playwright/test';
import { generateTestUser, registerUser } from './helpers';

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test.describe('Page Layout', () => {
    test('should display the logo', async ({ page }) => {
      await expect(page.locator('text=UsageFlow').first()).toBeVisible();
    });

    test('should display welcome heading', async ({ page }) => {
      await expect(page.locator('text=Welcome back')).toBeVisible();
    });

    test('should display sign in subtext', async ({ page }) => {
      await expect(page.locator('text=Sign in to your account to continue')).toBeVisible();
    });
  });

  test.describe('Login Form', () => {
    test('should have email input', async ({ page }) => {
      const input = page.locator('input[type="email"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Email address")')).toBeVisible();
    });

    test('should have password input', async ({ page }) => {
      const input = page.locator('input[type="password"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Password")')).toBeVisible();
    });

    test('should have submit button', async ({ page }) => {
      await expect(page.locator('button:has-text("Sign in")')).toBeVisible();
    });

    test('should have link to register page', async ({ page }) => {
      await expect(page.locator('text=Don\'t have an account?')).toBeVisible();
      await expect(page.locator('a:has-text("Start free trial")')).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should require email', async ({ page }) => {
      await page.fill('input[type="password"]', 'somepassword');
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/login/);
    });

    test('should require password', async ({ page }) => {
      await page.fill('input[type="email"]', 'test@test.com');
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/login/);
    });

    test('should validate email format', async ({ page }) => {
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', 'somepassword');
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to register when clicking Start free trial', async ({ page }) => {
      await page.click('a:has-text("Start free trial")');
      await expect(page).toHaveURL(/\/register/);
    });

    test('should navigate to landing when clicking logo', async ({ page }) => {
      await page.locator('a:has(text=UsageFlow)').first().click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Successful Login', () => {
    test('should login and redirect to dashboard', async ({ page }) => {
      // First register a user via API
      const user = await registerUser(page);

      // Navigate to login
      await page.goto('/login');

      // Fill login form
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);

      // Submit
      await page.click('button[type="submit"]');

      // Should show loading state
      await expect(page.locator('button:has-text("Signing in...")')).toBeVisible();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show error for invalid credentials', async ({ page }) => {
      await page.fill('input[type="email"]', 'nonexistent@test.com');
      await page.fill('input[type="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');

      // Should show error message (toast or inline)
      await expect(page.locator('text=/invalid|error|incorrect|not found/i')).toBeVisible({ timeout: 5000 });
    });

    test('should show error for wrong password', async ({ page }) => {
      // First register a user via API
      const user = await registerUser(page);

      // Navigate to login
      await page.goto('/login');

      // Try to login with wrong password
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', 'wrongpassword123');
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Visual Styling', () => {
    test('should have dark background theme', async ({ page }) => {
      const body = page.locator('div').first();
      await expect(body).toHaveCSS('background-color', 'rgb(10, 10, 15)');
    });

    test('should have gradient background elements', async ({ page }) => {
      // Check for gradient overlay
      const gradientElement = page.locator('.bg-gradient-to-b').first();
      await expect(gradientElement).toBeVisible();
    });
  });
});

test.describe('Login Flow Integration', () => {
  test('should complete full registration then login flow', async ({ page }) => {
    const user = generateTestUser();

    // Start at landing
    await page.goto('/');

    // Click Sign in
    await page.click('a:has-text("Sign in")');
    await expect(page).toHaveURL(/\/login/);

    // Click Start free trial to go to register
    await page.click('a:has-text("Start free trial")');
    await expect(page).toHaveURL(/\/register/);

    // Register
    await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Should be in dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Clear session (simulate logout by clearing storage)
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Go to login
    await page.goto('/login');

    // Login with same credentials
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Should be back in dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });
});
