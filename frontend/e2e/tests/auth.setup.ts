import { test as setup, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auth state file path (absolute) - same as in playwright.config.ts
const authFile = path.join(__dirname, '..', 'playwright', '.auth', 'user.json');

// Generate unique test credentials for this run
const timestamp = Date.now();
const testEmail = `e2e_test_${timestamp}@tokentrailapp.com`;
const testPassword = 'TestPassword123!';
const testCompany = `E2E Test Company ${timestamp}`;

// Export for other tests to use
export const testCredentials = {
  email: testEmail,
  password: testPassword,
  company: testCompany,
};

/**
 * Authentication Setup
 * Registers a new test user and establishes an authenticated session
 */
setup('authenticate', async ({ page }) => {
  console.log(`\n📝 Registering new test user: ${testEmail}\n`);

  // Go to registration page
  await page.goto('/register');

  // Wait for the page to load
  await page.waitForLoadState('networkidle');

  // Take screenshot of registration page
  await page.screenshot({ path: 'test-results/01-register-page.png' });

  // Fill in registration form
  // Look for company name field
  const companyInput = page.locator('input[name="company_name"], input[name="companyName"], input[placeholder*="company" i], input[placeholder*="Company" i]').first();
  if (await companyInput.isVisible()) {
    await companyInput.fill(testCompany);
  }

  // Look for full name field
  const nameInput = page.locator('input[name="full_name"], input[name="fullName"], input[name="name"], input[placeholder*="name" i]').first();
  if (await nameInput.isVisible()) {
    await nameInput.fill('E2E Test User');
  }

  // Fill email
  await page.locator('input[type="email"]').fill(testEmail);

  // Fill password
  const passwordInputs = page.locator('input[type="password"]');
  await passwordInputs.first().fill(testPassword);

  // If there's a confirm password field, fill it too
  if (await passwordInputs.count() > 1) {
    await passwordInputs.nth(1).fill(testPassword);
  }

  // Take screenshot before submission
  await page.screenshot({ path: 'test-results/02-register-filled.png' });

  // Submit registration form
  await page.locator('button[type="submit"]').click();

  // Wait for response - either redirect to dashboard or error
  await page.waitForLoadState('networkidle');

  // Take screenshot after submission
  await page.screenshot({ path: 'test-results/03-after-register.png' });

  // Check if we're on the dashboard (registration successful)
  const currentUrl = page.url();
  console.log(`Current URL after registration: ${currentUrl}`);

  if (currentUrl.includes('/app/dashboard') || currentUrl.includes('/dashboard')) {
    console.log('✅ Registration successful, redirected to dashboard');
  } else if (currentUrl.includes('/login')) {
    console.log('📧 Registration may require email verification, trying to login...');
    // Try to login with the credentials
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.locator('button[type="submit"]').click();
    await page.waitForLoadState('networkidle');
  } else {
    // Check for any error messages
    const errorText = await page.locator('.error, [role="alert"], .text-red-500, .text-destructive').textContent().catch(() => null);
    if (errorText) {
      console.log(`Registration error: ${errorText}`);
    }
  }

  // Wait for navigation to complete
  try {
    await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 });
    console.log('✅ Successfully logged in');
  } catch (e) {
    // Take a failure screenshot
    await page.screenshot({ path: 'test-results/04-login-failed.png' });
    console.log(`Current URL: ${page.url()}`);
    throw new Error(`Failed to complete authentication. Current URL: ${page.url()}`);
  }

  // Verify we're logged in by checking for navigation/sidebar
  await expect(page.locator('nav, aside, [role="navigation"]').first()).toBeVisible();

  // Take final screenshot
  await page.screenshot({ path: 'test-results/05-authenticated.png' });

  // Save authentication state
  await page.context().storageState({ path: authFile });

  console.log('✅ Authentication setup complete');
  console.log(`   Test user: ${testEmail}`);
});
