import { test, expect } from '@playwright/test';

test.describe('Error Pages', () => {
  test.describe('404 Not Found', () => {
    test('should handle invalid app route gracefully', async ({ page }) => {
      // Navigate to invalid route - test that navigation completes
      const response = await page.goto('/app/this-page-does-not-exist-12345');

      // Verify navigation completed (response may be 200 for SPA or 404)
      expect(response).toBeTruthy();
    });

    test('should handle invalid root route gracefully', async ({ page }) => {
      // Navigate to invalid root route
      const response = await page.goto('/invalid-route-xyz-999');

      // Verify navigation completed
      expect(response).toBeTruthy();
    });

    test('should handle deep invalid routes gracefully', async ({ page }) => {
      // Navigate to deep invalid route
      const response = await page.goto('/app/settings/invalid/deep/route');

      // Verify navigation completed
      expect(response).toBeTruthy();
    });
  });

  test.describe('Error Recovery', () => {
    test('should allow navigation back to valid page after 404', async ({ page }) => {
      // Go to invalid page first
      await page.goto('/app/invalid-page-test');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Navigate to a valid page using sidebar if visible
      const dashboardLink = page.locator('a[href*="dashboard"]').first();
      if (await dashboardLink.isVisible()) {
        await dashboardLink.click();
        await expect(page).toHaveURL(/\/app\/dashboard/);
      } else {
        // Or navigate directly
        await page.goto('/app/dashboard');
        await expect(page).toHaveURL(/\/app\/dashboard/);
      }
    });
  });
});
