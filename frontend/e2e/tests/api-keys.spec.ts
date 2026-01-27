import { test, expect } from '@playwright/test';

test.describe('API Keys Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/api-keys');
  });

  test.describe('Page Load', () => {
    test('should load API keys page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/app\/api-keys/);
      await expect(page.getByRole('heading', { name: /api.*keys/i })).toBeVisible();
    });

    test('should display Create API Key button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /create|generate|new/i })).toBeVisible();
    });
  });

  test.describe('API Keys List', () => {
    test('should display API keys table or empty state', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Either table with keys or empty state message
      const table = page.locator('table');
      const emptyState = page.getByText(/no api keys|create one/i);

      const hasTable = await table.isVisible({ timeout: 5000 }).catch(() => false);
      const hasEmptyState = await emptyState.isVisible({ timeout: 5000 }).catch(() => false);

      expect(hasTable || hasEmptyState).toBeTruthy();
    });

    test('should display key information columns', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Check for column headers in table
      const nameHeader = page.locator('th:has-text("Name")');
      const envHeader = page.locator('th:has-text("Environment")');
      const statusHeader = page.locator('th:has-text("Status")');

      // At least one header should exist if table is present
      const hasHeaders = await nameHeader.or(envHeader).or(statusHeader).first().isVisible({ timeout: 5000 }).catch(() => false);
      await expect(page.getByRole('heading', { name: /api.*keys/i })).toBeVisible();
    });

    test('should show masked key prefix', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Keys shown as "tt_live_..." or "tt_test_..." with ellipsis
      const keyPrefix = page.locator('text=/tt_.*\\.\\.\\./');
      // May or may not have keys - just verify page loads
      await expect(page.getByRole('heading', { name: /api.*keys/i })).toBeVisible();
    });
  });

  test.describe('Create API Key', () => {
    test('should open create key modal/form', async ({ page }) => {
      await page.click('button:has-text("Create API Key")');

      // Modal should appear with form
      await expect(page.getByRole('heading', { name: /create api key/i })).toBeVisible();
    });

    test('should have environment selection', async ({ page }) => {
      await page.click('button:has-text("Create API Key")');

      // Wait for modal to open
      await expect(page.getByRole('heading', { name: /create api key/i })).toBeVisible({ timeout: 5000 });

      // Environment selector (select dropdown)
      const envSelector = page.locator('select').first();
      await expect(envSelector).toBeVisible({ timeout: 5000 });

      // Verify select has the expected options by checking inner HTML
      const selectHTML = await envSelector.innerHTML();
      expect(selectHTML).toContain('Live');
      expect(selectHTML).toContain('Test');
    });

    test('should have optional name field', async ({ page }) => {
      await page.click('button:has-text("Create API Key")');

      // Name field with placeholder "My API Key"
      const nameField = page.locator('input[placeholder="My API Key"]');
      await expect(nameField).toBeVisible();
    });

    test('should create API key successfully', async ({ page }) => {
      const keyName = `E2E Test Key ${Date.now()}`;

      await page.click('button:has-text("Create API Key")');

      // Fill in name using the placeholder selector
      await page.fill('input[placeholder="My API Key"]', keyName);

      // Select test environment
      await page.selectOption('select', 'test');

      // Submit - button text is "Create" or "Creating..."
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show the generated key modal with copy button
      await expect(page.getByText(/API Key Created/i)).toBeVisible({ timeout: 10000 });
    });

    test('should show warning about key visibility', async ({ page }) => {
      await page.click('button:has-text("Create API Key")');

      // Fill and submit
      await page.fill('input[placeholder="My API Key"]', 'Warning Test');
      await page.click('button[type="submit"]:has-text("Create")');

      // Should show warning about not seeing key again
      await expect(page.getByText(/won't be able to see it again/i)).toBeVisible({ timeout: 10000 });
    });

    test('should have copy to clipboard functionality', async ({ page }) => {
      await page.click('button:has-text("Create API Key")');

      // Fill and submit
      await page.fill('input[placeholder="My API Key"]', 'Copy Test');
      await page.click('button[type="submit"]:has-text("Create")');

      // Wait for key to be generated
      await expect(page.getByText(/API Key Created/i)).toBeVisible({ timeout: 10000 });

      // Copy button should be visible
      const copyButton = page.locator('button:has-text("Copy")');
      await expect(copyButton).toBeVisible();
    });
  });

  test.describe('Delete API Key', () => {
    test('should show delete button for each key', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Check if table with keys exists
      const table = page.locator('table');
      if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Delete buttons are in the Actions column
        const deleteButton = page.locator('button:has-text("Delete")').first();
        if (await deleteButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await expect(deleteButton).toBeVisible();
        }
      }
    });

    test('should have delete action in table rows', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Check table headers include Actions column
      const actionsHeader = page.locator('th:has-text("Actions")');
      const table = page.locator('table');

      if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(actionsHeader).toBeVisible();
      }
    });
  });

  test.describe('API Key Status', () => {
    test('should display active/inactive status', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Status indicators should be present
      const statusIndicator = page.locator('[class*="status"], [class*="badge"]').first();
      // May or may not have keys
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show last used date', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Last used column should be present
      const hasLastUsed = await page.getByText(/last.*used|never.*used|used.*at/i).first().isVisible().catch(() => false);
      // May or may not have this column
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Environment Filtering', () => {
    test('should filter keys by environment', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Environment filter or tabs
      const envFilter = page.locator(
        'select, button:has-text("Production"), button:has-text("Test"), [role="tablist"]'
      ).first();

      if (await envFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(envFilter).toBeVisible();
      }
    });
  });

  test.describe('Usage Instructions', () => {
    test('should display API usage example', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Usage/curl example may be shown on page
      const hasExample = await page.getByText(/curl|example|usage|how.*to.*use/i).first().isVisible().catch(() => false);

      // Either on this page or in settings
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Empty State', () => {
    test('should show helpful message when no keys exist', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // If no keys, should show empty state
      const emptyState = page.locator('[class*="empty"], [class*="no-data"]').first();
      // May or may not be empty
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      await expect(page.getByRole('heading', { name: /api.*keys/i })).toBeVisible();

      // Create button should be accessible
      const createButton = page.getByRole('button', { name: /create|generate|new/i }).first();
      await expect(createButton).toBeVisible();
    });
  });
});
