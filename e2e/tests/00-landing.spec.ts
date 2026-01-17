import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test.describe('Navigation', () => {
    test('should display the logo and brand name', async ({ page }) => {
      await expect(page.locator('text=UsageFlow').first()).toBeVisible();
    });

    test('should have navigation links', async ({ page }) => {
      await expect(page.locator('a[href="#features"]')).toBeVisible();
      await expect(page.locator('a[href="#pricing"]')).toBeVisible();
      await expect(page.locator('a[href="#developers"]')).toBeVisible();
    });

    test('should have sign in and start free buttons', async ({ page }) => {
      await expect(page.locator('a:has-text("Sign in")')).toBeVisible();
      await expect(page.locator('a:has-text("Start Free")')).toBeVisible();
    });

    test('should navigate to login page when clicking Sign in', async ({ page }) => {
      await page.click('a:has-text("Sign in")');
      await expect(page).toHaveURL(/\/login/);
    });

    test('should navigate to register page when clicking Start Free', async ({ page }) => {
      await page.locator('nav a:has-text("Start Free")').click();
      await expect(page).toHaveURL(/\/register/);
    });
  });

  test.describe('Hero Section', () => {
    test('should display the early access badge', async ({ page }) => {
      await expect(page.locator('text=Early Access - Free for 30 Days')).toBeVisible();
    });

    test('should display the main headline', async ({ page }) => {
      await expect(page.locator('h1:has-text("LLM Billing")')).toBeVisible();
      await expect(page.locator('text=Made Simple')).toBeVisible();
    });

    test('should display the value proposition text', async ({ page }) => {
      await expect(page.locator('text=Track, optimize, and bill for AI usage')).toBeVisible();
    });

    test('should have Start Free Trial CTA button', async ({ page }) => {
      const ctaButton = page.locator('section a:has-text("Start Free Trial")').first();
      await expect(ctaButton).toBeVisible();
    });

    test('should have See Features button', async ({ page }) => {
      await expect(page.locator('a:has-text("See Features")')).toBeVisible();
    });

    test('should display statistics', async ({ page }) => {
      await expect(page.locator('text=50%')).toBeVisible();
      await expect(page.locator('text=Average cost savings with smart routing')).toBeVisible();
      await expect(page.locator('text=10M+')).toBeVisible();
      await expect(page.locator('text=<100ms')).toBeVisible();
      await expect(page.locator('text=99.9%')).toBeVisible();
    });
  });

  test.describe('Dashboard Preview', () => {
    test('should display the dashboard mockup', async ({ page }) => {
      await expect(page.locator('text=app.usageflow.io/dashboard')).toBeVisible();
    });

    test('should display animated stat cards', async ({ page }) => {
      await expect(page.locator('text=Total Spend')).toBeVisible();
      await expect(page.locator('text=API Calls')).toBeVisible();
      await expect(page.locator('text=Active Customers')).toBeVisible();
      await expect(page.locator('text=Avg Cost/Call')).toBeVisible();
    });

    test('should display the live usage chart', async ({ page }) => {
      await expect(page.locator('text=Live Usage Stream')).toBeVisible();
      await expect(page.locator('text=Streaming')).toBeVisible();
      await expect(page.locator('text=Real-time')).toBeVisible();
    });
  });

  test.describe('Features Section', () => {
    test('should display features section heading', async ({ page }) => {
      await expect(page.locator('text=Everything you need to manage AI costs')).toBeVisible();
    });

    test('should display all feature cards', async ({ page }) => {
      const features = [
        'Real-time Usage Tracking',
        'Smart Model Routing',
        'Predictive Alerts',
        'Per-Customer Billing',
        'Agent Workflow Budgets',
        'Multi-Provider Support',
      ];

      for (const feature of features) {
        await expect(page.locator(`text=${feature}`)).toBeVisible();
      }
    });

    test('should have feature descriptions', async ({ page }) => {
      await expect(page.locator('text=Monitor every API call, token, and cost in real-time')).toBeVisible();
      await expect(page.locator('text=Automatically route requests to the optimal model')).toBeVisible();
    });
  });

  test.describe('Developer Section', () => {
    test('should display the integration badge', async ({ page }) => {
      await expect(page.locator('text=5 minute integration')).toBeVisible();
    });

    test('should display the integration headline', async ({ page }) => {
      await expect(page.locator('text=Integrate in minutes')).toBeVisible();
    });

    test('should display code example', async ({ page }) => {
      await expect(page.locator('text=tracking.ts')).toBeVisible();
      await expect(page.locator('text=import { UsageFlow }')).toBeVisible();
    });

    test('should display SDK features', async ({ page }) => {
      await expect(page.locator('text=Works with OpenAI, Anthropic, Google, and LiteLLM')).toBeVisible();
      await expect(page.locator('text=Automatic token counting and cost calculation')).toBeVisible();
      await expect(page.locator('text=TypeScript support with full type safety')).toBeVisible();
    });
  });

  test.describe('Pricing Section', () => {
    test('should display pricing section heading', async ({ page }) => {
      await expect(page.locator('text=Simple, transparent pricing')).toBeVisible();
    });

    test('should display Free tier', async ({ page }) => {
      const freeCard = page.locator('text=Free').first().locator('..');
      await expect(page.locator('h3:has-text("Free")')).toBeVisible();
      await expect(page.locator('text=$0')).toBeVisible();
      await expect(page.locator('text=Up to 10K API calls/month')).toBeVisible();
    });

    test('should display Pro tier with Most Popular badge', async ({ page }) => {
      await expect(page.locator('h3:has-text("Pro")')).toBeVisible();
      await expect(page.locator('text=$29')).toBeVisible();
      await expect(page.locator('text=Most Popular')).toBeVisible();
      await expect(page.locator('text=Up to 500K API calls/month')).toBeVisible();
    });

    test('should display Enterprise tier', async ({ page }) => {
      await expect(page.locator('h3:has-text("Enterprise")')).toBeVisible();
      await expect(page.locator('text=Custom')).toBeVisible();
      await expect(page.locator('text=Unlimited API calls')).toBeVisible();
    });

    test('should have CTAs for all pricing tiers', async ({ page }) => {
      await expect(page.locator('a:has-text("Get Started Free")')).toBeVisible();
      await expect(page.locator('a:has-text("Start Free Trial")').nth(1)).toBeVisible();
      await expect(page.locator('a:has-text("Contact Us")')).toBeVisible();
    });
  });

  test.describe('CTA Section', () => {
    test('should display final CTA section', async ({ page }) => {
      await expect(page.locator('text=Ready to take control of your AI costs?')).toBeVisible();
    });

    test('should display no credit card required badge', async ({ page }) => {
      await expect(page.locator('text=No Credit Card Required')).toBeVisible();
    });

    test('should display 30-day trial mention', async ({ page }) => {
      await expect(page.locator('text=Start your 30-day free trial today')).toBeVisible();
    });
  });

  test.describe('Footer', () => {
    test('should display footer with logo', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('text=UsageFlow')).toBeVisible();
    });

    test('should display product links', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('text=Features')).toBeVisible();
      await expect(footer.locator('text=Pricing')).toBeVisible();
      await expect(footer.locator('text=Documentation')).toBeVisible();
    });

    test('should display company links', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('text=About')).toBeVisible();
      await expect(footer.locator('text=Blog')).toBeVisible();
      await expect(footer.locator('text=Careers')).toBeVisible();
    });

    test('should display legal links', async ({ page }) => {
      const footer = page.locator('footer');
      await expect(footer.locator('text=Privacy')).toBeVisible();
      await expect(footer.locator('text=Terms')).toBeVisible();
      await expect(footer.locator('text=Security')).toBeVisible();
    });

    test('should display copyright', async ({ page }) => {
      await expect(page.locator('text=© 2025 UsageFlow. All rights reserved.')).toBeVisible();
    });
  });

  test.describe('Smooth Scroll Navigation', () => {
    test('should scroll to features section', async ({ page }) => {
      await page.click('a[href="#features"]');
      // Wait for scroll animation
      await page.waitForTimeout(500);
      const featuresSection = page.locator('#features');
      await expect(featuresSection).toBeInViewport();
    });

    test('should scroll to pricing section', async ({ page }) => {
      await page.click('a[href="#pricing"]');
      await page.waitForTimeout(500);
      const pricingSection = page.locator('#pricing');
      await expect(pricingSection).toBeInViewport();
    });

    test('should scroll to developers section', async ({ page }) => {
      await page.click('a[href="#developers"]');
      await page.waitForTimeout(500);
      const developersSection = page.locator('#developers');
      await expect(developersSection).toBeInViewport();
    });
  });

  test.describe('CTA Click Throughs', () => {
    test('should navigate to register from hero CTA', async ({ page }) => {
      await page.locator('section a:has-text("Start Free Trial")').first().click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should navigate to register from pricing Free tier', async ({ page }) => {
      await page.locator('a:has-text("Get Started Free")').click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should navigate to register from pricing Pro tier', async ({ page }) => {
      // Navigate to pricing section first
      await page.click('a[href="#pricing"]');
      await page.waitForTimeout(500);
      // Click the Pro tier CTA (not the hero one)
      await page.locator('#pricing a:has-text("Start Free Trial")').click();
      await expect(page).toHaveURL(/\/register/);
    });

    test('should navigate to register from final CTA', async ({ page }) => {
      // Scroll to bottom
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(500);
      // Click the final CTA
      const finalCta = page.locator('section').last().locator('a:has-text("Start Free Trial")');
      await finalCta.click();
      await expect(page).toHaveURL(/\/register/);
    });
  });
});
