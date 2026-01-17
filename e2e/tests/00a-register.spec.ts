import { test, expect } from '@playwright/test';
import { generateTestUser } from './helpers';

test.describe('Registration Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test.describe('Page Layout', () => {
    test('should display the logo', async ({ page }) => {
      await expect(page.locator('text=UsageFlow').first()).toBeVisible();
    });

    test('should display early access badge', async ({ page }) => {
      await expect(page.locator('text=Early Access - Free for 30 Days')).toBeVisible();
    });

    test('should display the main headline', async ({ page }) => {
      await expect(page.locator('text=Start using UsageFlow today')).toBeVisible();
    });

    test('should display instant access subtext', async ({ page }) => {
      await expect(page.locator('text=Get instant access to all features')).toBeVisible();
    });

    test('should display form heading', async ({ page }) => {
      await expect(page.locator('text=Create your account')).toBeVisible();
    });
  });

  test.describe('Benefits Section (Desktop)', () => {
    test('should display all benefits', async ({ page }) => {
      // Skip on mobile viewport
      const viewportSize = page.viewportSize();
      if (viewportSize && viewportSize.width < 1024) {
        test.skip();
        return;
      }

      const benefits = [
        'Track every LLM API call in real-time',
        'Save 30-50% with smart model routing',
        'Bill customers based on actual usage',
        'Full access free for 30 days',
      ];

      for (const benefit of benefits) {
        await expect(page.locator(`text=${benefit}`)).toBeVisible();
      }
    });
  });

  test.describe('Registration Form', () => {
    test('should have company name input', async ({ page }) => {
      const input = page.locator('input[name="company_name"], input[placeholder*="Acme"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Company name")')).toBeVisible();
    });

    test('should have full name input', async ({ page }) => {
      const input = page.locator('input[name="full_name"], input[placeholder*="John"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Your name")')).toBeVisible();
    });

    test('should have email input', async ({ page }) => {
      const input = page.locator('input[type="email"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Work email")')).toBeVisible();
    });

    test('should have password input', async ({ page }) => {
      const input = page.locator('input[type="password"]');
      await expect(input).toBeVisible();
      await expect(page.locator('label:has-text("Password")')).toBeVisible();
    });

    test('should have submit button', async ({ page }) => {
      await expect(page.locator('button:has-text("Get Started Free")')).toBeVisible();
    });

    test('should display no credit card required text', async ({ page }) => {
      await expect(page.locator('text=No credit card required')).toBeVisible();
    });

    test('should have link to login page', async ({ page }) => {
      await expect(page.locator('text=Already have an account?')).toBeVisible();
      await expect(page.locator('a:has-text("Sign in")')).toBeVisible();
    });
  });

  test.describe('Form Validation', () => {
    test('should require company name', async ({ page }) => {
      const user = generateTestUser();

      // Fill all except company name
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);

      // Try to submit
      await page.click('button[type="submit"]');

      // Should not navigate away (form validation)
      await expect(page).toHaveURL(/\/register/);
    });

    test('should require email', async ({ page }) => {
      const user = generateTestUser();

      // Fill all except email
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
      await page.fill('input[type="password"]', user.password);

      // Try to submit
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/register/);
    });

    test('should require password', async ({ page }) => {
      const user = generateTestUser();

      // Fill all except password
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
      await page.fill('input[type="email"]', user.email);

      // Try to submit
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/register/);
    });

    test('should validate email format', async ({ page }) => {
      const user = generateTestUser();

      // Fill with invalid email
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
      await page.fill('input[type="email"]', 'invalid-email');
      await page.fill('input[type="password"]', user.password);

      // Try to submit
      await page.click('button[type="submit"]');

      // Should not navigate away
      await expect(page).toHaveURL(/\/register/);
    });

    test('should require minimum password length', async ({ page }) => {
      const user = generateTestUser();

      // Fill with short password
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', 'short');

      // Try to submit
      await page.click('button[type="submit"]');

      // Should not navigate away (password must be at least 8 characters)
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Navigation', () => {
    test('should navigate to login when clicking Sign in link', async ({ page }) => {
      await page.click('a:has-text("Sign in")');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to landing when clicking logo', async ({ page }) => {
      await page.locator('a:has(text=UsageFlow)').first().click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('Successful Registration', () => {
    test('should register and redirect to dashboard', async ({ page }) => {
      const user = generateTestUser();

      // Fill registration form
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', user.company);
      await page.fill('input[placeholder*="John"], input[name="full_name"]', 'Test User');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);

      // Submit
      await page.click('button[type="submit"]');

      // Should show loading state
      await expect(page.locator('button:has-text("Creating account...")')).toBeVisible();

      // Should redirect to dashboard
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });

      // Should show success toast or dashboard content
      await expect(page.locator('text=Dashboard')).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Error Handling', () => {
    test('should show error for duplicate email', async ({ page }) => {
      const user = generateTestUser();

      // Register first user via API
      await page.request.post('http://localhost:8000/api/v1/auth/register', {
        data: {
          email: user.email,
          password: user.password,
          company_name: user.company,
        },
      });

      // Try to register same email via UI
      await page.fill('input[placeholder*="Acme"], input[name="company_name"]', 'Another Company');
      await page.fill('input[type="email"]', user.email);
      await page.fill('input[type="password"]', user.password);

      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/already exists|already registered|email.*taken/i')).toBeVisible({ timeout: 5000 });
    });
  });
});
