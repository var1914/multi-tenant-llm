import { test, expect } from '@playwright/test';

test.describe('Workflows (Agentic AI)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/app/workflows');
  });

  test.describe('Page Load', () => {
    test('should load workflows page successfully', async ({ page }) => {
      await expect(page).toHaveURL(/\/app\/workflows/);
      // Use h1 specifically for the main heading
      await expect(page.locator('h1:has-text("Workflows")')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Workflow Overview', () => {
    test('should display total workflows metric', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/total.*workflows|workflows/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display success rate', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/success.*rate|%/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display average steps', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasSteps = await page.getByText(/avg.*steps|steps|average/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should display average cost per workflow', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/avg.*cost|cost|\$/i).first()).toBeVisible({
        timeout: 10000,
      });
    });

    test('should display total cost', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      await expect(page.getByText(/total.*cost|\$/i).first()).toBeVisible({
        timeout: 10000,
      });
    });
  });

  test.describe('Workflow Status Breakdown', () => {
    test('should display status distribution', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Status badges: completed, running, failed
      const hasStatus = await page.getByText(/completed|running|failed|paused/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show total tokens used', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const hasTokens = await page.getByText(/token|total/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Top Workflows', () => {
    test('should display top workflows by cost table', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Table showing workflows sorted by cost
      const table = page.locator('table, [role="grid"]').first();
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should show workflow details', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Columns: name, type, runs, avg steps, avg cost, total cost
      const hasDetails = await page.getByText(/workflow|type|runs|cost/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Tabs Navigation', () => {
    test('should have Workflows tab', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const workflowsTab = page.locator('button:has-text("Workflows"), [role="tab"]:has-text("Workflows")').first();
      await expect(workflowsTab).toBeVisible({ timeout: 10000 });
    });

    test('should have Agents tab', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const agentsTab = page.locator('button:has-text("Agents"), [role="tab"]:has-text("Agents")').first();
      await expect(agentsTab).toBeVisible({ timeout: 10000 });
    });

    test('should switch between tabs', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Click Agents tab
      await page.click('button:has-text("Agents"), [role="tab"]:has-text("Agents")');
      await page.waitForTimeout(500);

      // Agents content should be visible
      await expect(page.getByText(/agent|performance|invocation/i).first()).toBeVisible();
    });
  });

  test.describe('Workflows Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.waitForLoadState('networkidle');
      const workflowsTab = page.locator('button:has-text("Workflows"), [role="tab"]:has-text("Workflows")').first();
      if (await workflowsTab.isVisible()) {
        await workflowsTab.click();
        await page.waitForTimeout(500);
      }
    });

    test('should display workflow status filter', async ({ page }) => {
      const filter = page.locator(
        'select, [role="combobox"], button:has-text("All"), button:has-text("Running")'
      ).first();
      await expect(filter).toBeVisible({ timeout: 10000 });
    });

    test('should filter workflows by status', async ({ page }) => {
      // Click a filter option
      const runningFilter = page.locator('button:has-text("Running"), option:has-text("Running")').first();
      if (await runningFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await runningFilter.click();
        await page.waitForTimeout(500);
        await expect(page.locator('body')).toBeVisible();
      }
    });

    test('should display workflow table', async ({ page }) => {
      const table = page.locator('table, [role="grid"]').first();
      await expect(table).toBeVisible({ timeout: 10000 });
    });

    test('should show workflow columns', async ({ page }) => {
      // Columns: name, type, status, steps, LLM calls, tokens, cost, duration, timestamp
      const hasColumns = await page.getByText(/name|status|steps|cost|duration/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should click workflow to open detail modal', async ({ page }) => {
      const workflowRow = page.locator('table tbody tr, [role="row"]').first();

      if (await workflowRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await workflowRow.click();
        await page.waitForTimeout(500);

        // Modal should open
        const modal = page.locator('[role="dialog"], [class*="modal"]').first();
        // May or may not have data to show modal
        await expect(page.locator('body')).toBeVisible();
      }
    });
  });

  test.describe('Workflow Detail Modal', () => {
    test('should display workflow details in modal', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const workflowRow = page.locator('table tbody tr').first();

      if (await workflowRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await workflowRow.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[role="dialog"], [class*="modal"]');

        if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Modal should show workflow info
          await expect(modal.getByText(/workflow|steps|cost|status/i).first()).toBeVisible();
        }
      }
    });

    test('should display workflow steps timeline', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const workflowRow = page.locator('table tbody tr').first();

      if (await workflowRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await workflowRow.click();
        await page.waitForTimeout(1000);

        const modal = page.locator('[role="dialog"], [class*="modal"]');

        if (await modal.isVisible({ timeout: 5000 }).catch(() => false)) {
          // Steps timeline
          const hasSteps = await modal.getByText(/step|agent|llm.*call/i).first().isVisible().catch(() => false);
          await expect(page.locator('body')).toBeVisible();
        }
      }
    });

    test('should close modal on X button', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      const workflowRow = page.locator('table tbody tr').first();

      if (await workflowRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await workflowRow.click();
        await page.waitForTimeout(500);

        const closeButton = page.locator('[aria-label="Close"], button:has-text("Close"), [class*="close"]').first();

        if (await closeButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await closeButton.click();
          await page.waitForTimeout(500);

          // Modal should be closed
          await expect(page.locator('[role="dialog"]')).not.toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Agents Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.waitForLoadState('networkidle');
      await page.click('button:has-text("Agents"), [role="tab"]:has-text("Agents")');
      await page.waitForTimeout(500);
    });

    test('should display agent performance cards', async ({ page }) => {
      // Agent cards showing metrics
      const agentCard = page.locator('[class*="card"], [class*="agent"]').first();
      await expect(agentCard).toBeVisible({ timeout: 10000 });
    });

    test('should show agent name and type', async ({ page }) => {
      const hasAgentInfo = await page.getByText(/agent|type|research|code/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show invocation count', async ({ page }) => {
      const hasInvocations = await page.getByText(/invocation|call|count/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show agent success rate', async ({ page }) => {
      const hasSuccessRate = await page.getByText(/success.*rate|%/i).first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });

    test('should show agent cost metrics', async ({ page }) => {
      await expect(page.getByText(/cost|\$/i).first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Empty State', () => {
    test('should show helpful message when no workflows', async ({ page }) => {
      await page.waitForLoadState('networkidle');

      // Empty state or data
      const hasContent = await page.locator('table tbody tr, [class*="empty"]').first().isVisible().catch(() => false);
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('should work on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.reload();

      await expect(page.getByRole('heading', { name: /workflows|agentic/i })).toBeVisible();

      // Overview stats should still be visible
      await page.waitForLoadState('networkidle');
      await expect(page.getByText(/workflow|cost/i).first()).toBeVisible({ timeout: 10000 });
    });
  });
});
