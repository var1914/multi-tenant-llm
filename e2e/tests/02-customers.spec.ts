import { test, expect } from '@playwright/test';
import { generateTestUser, login, navigateTo } from './helpers';

test.describe('Customer Management', () => {
  let user: { email: string; password: string; company: string; token: string };

  test.beforeEach(async ({ page }) => {
    // Register and login before each test
    user = generateTestUser() as typeof user;

    const response = await page.request.post('http://localhost:8000/api/v1/auth/register', {
      data: {
        email: user.email,
        password: user.password,
        company_name: user.company,
      },
    });

    const data = await response.json();
    user.token = data.access_token;

    await login(page, user.email, user.password);
  });

  test('should display customers page', async ({ page }) => {
    await navigateTo(page, 'Customers');

    // Should show customers heading
    await expect(page.locator('h1:has-text("Customers")')).toBeVisible();

    // Should show "Add Customer" button
    await expect(page.locator('button:has-text("Add Customer")')).toBeVisible();
  });

  test('should create a new customer', async ({ page }) => {
    await navigateTo(page, 'Customers');

    // Click add customer button
    await page.click('button:has-text("Add Customer")');

    // Fill the form
    const customerId = `e2e_customer_${Date.now()}`;
    await page.fill('input[placeholder*="customer" i], input[name="external_id"]', customerId);
    await page.fill('input[placeholder*="John" i], input[name="name"]', 'E2E Test Customer');
    await page.fill('input[type="email"]:not([name="email"]):last-of-type, input[placeholder*="john@" i]', 'e2e@test.com');

    // Submit
    await page.click('button:has-text("Create")');

    // Should show the new customer in the list
    await expect(page.locator(`text=${customerId}`)).toBeVisible({ timeout: 5000 });
  });

  test('should create customer with workflow budget', async ({ page }) => {
    await navigateTo(page, 'Customers');

    await page.click('button:has-text("Add Customer")');

    // Fill basic info
    const customerId = `budget_customer_${Date.now()}`;
    await page.fill('input[placeholder*="customer" i], input[name="external_id"]', customerId);
    await page.fill('input[placeholder*="John" i], input[name="name"]', 'Budget Test Customer');

    // Fill workflow budget
    await page.fill('input[placeholder*="0.50" i], input[type="number"]', '0.50');
    await page.selectOption('select', 'pause');

    // Submit
    await page.click('button:has-text("Create")');

    // Should show customer with budget indicator
    await expect(page.locator(`text=${customerId}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Auto-pause')).toBeVisible();
  });

  test('should edit a customer', async ({ page }) => {
    // First create a customer via API
    const customerId = `edit_test_${Date.now()}`;
    await page.request.post('http://localhost:8000/api/v1/customers', {
      headers: { Authorization: `Bearer ${user.token}` },
      data: {
        external_id: customerId,
        name: 'Original Name',
      },
    });

    await navigateTo(page, 'Customers');

    // Wait for customer to appear
    await expect(page.locator(`text=${customerId}`)).toBeVisible();

    // Click edit button
    await page.click(`tr:has-text("${customerId}") button:has-text("Edit")`);

    // Update the name
    await page.fill('input[placeholder*="John" i], input[name="name"]', 'Updated Name');

    // Set workflow budget
    await page.fill('input[placeholder*="0.50" i], input[type="number"]', '1.00');

    // Save
    await page.click('button:has-text("Save")');

    // Should show updated data
    await expect(page.locator('text=Updated Name')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=$1.00')).toBeVisible();
  });

  test('should show customer usage statistics', async ({ page }) => {
    await navigateTo(page, 'Customers');

    // Table should have columns for Events, Usage, Cost
    await expect(page.locator('th:has-text("Events")')).toBeVisible();
    await expect(page.locator('th:has-text("Cost")')).toBeVisible();
  });
});
