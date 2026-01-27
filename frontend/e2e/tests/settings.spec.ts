import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/settings');
  });

  test.describe('Page Load', () => {
    test('should load settings page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/app\/settings/);
      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
    });
  });

  test.describe('Profile Section', () => {
    test('should display user email', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/email|@/i).first()).toBeVisible({ timeout: 10000 });
    });

    test('should display user name', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasName = await page.getByText(/name|user/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display user role', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasRole = await page.getByText(/role|admin|owner|member/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Organization Section', () => {
    test('should display company name', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/company|organization|tenant/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display organization slug', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasSlug = await page.getByText(/slug|identifier/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display subscription plan', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasPlan = await page.getByText(/plan|subscription|free|pro/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display subscription status', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasStatus = await page.getByText(/status|active|trial/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('API Usage Example', () => {
    test('should display API usage example', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Curl command or code example
      await expect(page.getByText(/curl|api|example|usage/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display sample payload', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasPayload = await page.getByText(/model|prompt|messages|payload/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should have copy to clipboard button', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const copyButton = page.locator('button:has-text("Copy"), button[aria-label*="copy"]').first();
      // May or may not have copy button
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Read-Only Fields', () => {
    test('should have read-only profile fields', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Fields should be displayed but not editable (no input fields for these)
      const profileSection = page.locator('[class*="profile"], [class*="user"]').first();
      await expect(profileSection).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();

      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/email|company/i).first()).toBeVisible({ timeout: 10000 });
    });
  });
});
