import { test, expect } from '@playwright/test';
import { generateTestUser, login } from './helpers';

test.describe('Authentication Flow', () => {
  test('should register a new user', async ({ page }) => {
    const user = generateTestUser();

    await page.goto('/register');

    // Fill registration form
    await page.fill('input[placeholder*="company" i], input[name="company_name"]', user.company);
    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);

    // Submit
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

    // Should show company name or dashboard content
    await expect(page.locator('text=Dashboard')).toBeVisible();
  });

  test('should login with valid credentials', async ({ page }) => {
    // First register a user via API
    const user = generateTestUser();

    await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    // Now login via UI
    await page.goto('/login');

    await page.fill('input[type="email"]', user.email);
    await page.fill('input[type="password"]', user.password);
    await page.click('button[type="submit"]');

    // Should redirect to dashboard
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('input[type="email"]', 'nonexistent@test.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');

    // Should show error message
    await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 5000 });
  });

  test('should logout successfully', async ({ page }) => {
    // Register and login
    const user = generateTestUser();

    await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    await login(page, user.email, user.password);

    // Find and click logout button
    await page.click('button:has-text("Logout"), button:has-text("Sign out"), [aria-label="logout"]');

    // Should redirect to login
    await expect(page).toHaveURL(/login/, { timeout: 5000 });
  });

  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Clear any stored auth
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });
});
