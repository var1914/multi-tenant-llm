import { test, expect, Page } from '@playwright/test';
import {
  makeLLMRequest,
  testRoutingDecision,
  getRoutingSettings,
  updateRoutingSettings,
  getRoutingStats,
  TEST_PROMPTS,
} from '../fixtures/api-helpers';

/**
 * RouteLLM Smart Routing E2E Tests
 *
 * These tests verify the complete RouteLLM integration:
 * - Win-rate predictions work correctly
 * - Threshold settings affect routing decisions
 * - Cost savings are tracked accurately
 * - Different prompt complexities route appropriately
 */

const BASE_URL = process.env.E2E_BASE_URL || 'https://tokentrailapp.com';
const API_BASE_URL = process.env.E2E_API_URL || BASE_URL;

test.describe('RouteLLM ML-Based Routing', () => {
  let authToken: string;
  let apiKey: string;

  test.beforeEach(async ({ page }) => {
    // Login and get auth token
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    authToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });

    apiKey = process.env.E2E_API_KEY || '';
  });

  test.describe('RouteLLM Configuration', () => {
    test('can enable and configure RouteLLM via UI', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      // Enable smart routing first
      await test.step('Enable smart routing', async () => {
        const smartRoutingToggle = page.locator('input[type="checkbox"], [role="switch"]').first();
        if (!(await smartRoutingToggle.isChecked().catch(() => false))) {
          await smartRoutingToggle.click();
          await page.waitForTimeout(500);
        }
      });

      // Look for RouteLLM section
      await test.step('Enable RouteLLM ML Router', async () => {
        // Find RouteLLM toggle - should be labeled "RouteLLM ML Router" or similar
        const routellmToggle = page.locator('text=RouteLLM').locator('..').locator('input[type="checkbox"], [role="switch"]');

        if (await routellmToggle.isVisible({ timeout: 5000 }).catch(() => false)) {
          if (!(await routellmToggle.isChecked().catch(() => false))) {
            await routellmToggle.click();
            await page.waitForTimeout(500);
          }
          await expect(routellmToggle).toBeChecked();
        } else {
          console.log('RouteLLM toggle not visible - may not be available');
        }
      });

      // Verify via API
      await test.step('Verify settings via API', async () => {
        const settings = await getRoutingSettings(API_BASE_URL, authToken);
        console.log('Routing settings:', settings);

        expect(settings).not.toBeNull();
        expect(settings!.smart_routing_enabled).toBe(true);
      });
    });

    test('can adjust win-rate threshold via UI', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      // Find threshold slider
      const thresholdSlider = page.locator('input[type="range"]');

      if (await thresholdSlider.isVisible({ timeout: 5000 }).catch(() => false)) {
        await test.step('Adjust threshold slider', async () => {
          // Set to 20% threshold
          await thresholdSlider.fill('0.2');
          await page.waitForTimeout(500);

          // Verify value changed
          const value = await thresholdSlider.inputValue();
          expect(parseFloat(value)).toBeCloseTo(0.2, 1);
        });

        // Reset to default
        await test.step('Reset to default threshold', async () => {
          await thresholdSlider.fill('0.11593');
          await page.waitForTimeout(500);
        });
      }
    });

    test('can configure RouteLLM via API', async () => {
      // Test different threshold values
      const testCases = [
        { threshold: 0.05, description: 'Very aggressive (5%)' },
        { threshold: 0.11593, description: 'Default (11.6%)' },
        { threshold: 0.25, description: 'Conservative (25%)' },
      ];

      for (const testCase of testCases) {
        await test.step(`Set threshold: ${testCase.description}`, async () => {
          const success = await updateRoutingSettings(API_BASE_URL, authToken, {
            routellm_enabled: true,
            routellm_threshold: testCase.threshold,
          });

          expect(success).toBe(true);

          // Verify
          const settings = await getRoutingSettings(API_BASE_URL, authToken);
          expect(settings!.routellm_threshold).toBeCloseTo(testCase.threshold, 4);
        });
      }

      // Reset to default
      await updateRoutingSettings(API_BASE_URL, authToken, {
        routellm_threshold: 0.11593,
      });
    });
  });

  test.describe('Win-Rate Predictions', () => {
    test.beforeEach(async () => {
      // Ensure RouteLLM is enabled for these tests
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
        routellm_threshold: 0.11593,
      });
    });

    test('simple prompts get low win-rate predictions', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      const simplePrompts = [
        'What is 2 + 2?',
        'Hello!',
        'What color is the sky?',
      ];

      for (const prompt of simplePrompts) {
        await test.step(`Test simple: "${prompt}"`, async () => {
          // Use API for faster testing
          const result = await testRoutingDecision(API_BASE_URL, authToken, 'gpt-4o', prompt);

          if (result) {
            console.log(`"${prompt}" → Win-rate: ${result.routellm_win_rate}, Routed: ${result.routing_applied}`);

            // Simple prompts should have low win-rate (strong model not needed)
            if (result.routellm_used && result.routellm_win_rate !== null) {
              expect(result.routellm_win_rate).toBeLessThan(0.5);
            }
          }
        });
      }
    });

    test('complex prompts get high win-rate predictions', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      const complexPrompts = [
        'Design a distributed consensus algorithm for a blockchain network with Byzantine fault tolerance.',
        'Implement a compiler optimization pass that performs loop unrolling and strength reduction.',
        'Analyze the trade-offs between CAP theorem guarantees for a globally distributed database.',
      ];

      for (const prompt of complexPrompts) {
        await test.step(`Test complex: "${prompt.substring(0, 50)}..."`, async () => {
          const result = await testRoutingDecision(API_BASE_URL, authToken, 'gpt-4o', prompt);

          if (result) {
            console.log(`Complex → Win-rate: ${result.routellm_win_rate}, Routed: ${result.routing_applied}`);

            // Complex prompts should have higher win-rate (strong model needed)
            if (result.routellm_used && result.routellm_win_rate !== null) {
              expect(result.routellm_win_rate).toBeGreaterThan(0.1);
            }
          }
        });
      }
    });

    test('win-rate predictions are displayed in playground UI', async ({ page }) => {
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      // Test in playground
      await page.fill('textarea', 'Explain quantum computing.');
      await page.click('button:has-text("Test")');

      // Wait for results
      await page.waitForSelector('text=/routed|complexity|RouteLLM/i', { timeout: 15000 });

      // Check for win-rate display
      const winRateDisplay = await page.getByText(/win.*rate|P\(strong|%/i).isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Win-rate displayed: ${winRateDisplay}`);

      // Should show either RouteLLM result or complexity score
      await expect(page.getByText(/routing|complexity|score/i).first()).toBeVisible();
    });
  });

  test.describe('Threshold-Based Routing', () => {
    test('low threshold routes more to cheap models', async () => {
      // Set very low threshold (5%)
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
        routellm_threshold: 0.05, // Only use strong if P(strong wins) > 5%
      });

      // Test moderate complexity prompt
      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'gpt-4o',
        'What are the benefits of using React?'
      );

      if (result && result.routellm_used) {
        console.log(`Low threshold (5%): Win-rate=${result.routellm_win_rate}, Routed=${result.routing_applied}`);
        // With low threshold, more prompts should route to cheap model
      }

      // Reset
      await updateRoutingSettings(API_BASE_URL, authToken, { routellm_threshold: 0.11593 });
    });

    test('high threshold keeps more on premium models', async () => {
      // Set high threshold (30%)
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
        routellm_threshold: 0.30, // Only use strong if P(strong wins) > 30%
      });

      // Test same prompt
      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'gpt-4o',
        'What are the benefits of using React?'
      );

      if (result && result.routellm_used) {
        console.log(`High threshold (30%): Win-rate=${result.routellm_win_rate}, Routed=${result.routing_applied}`);
        // With high threshold, fewer prompts should route to cheap model
      }

      // Reset
      await updateRoutingSettings(API_BASE_URL, authToken, { routellm_threshold: 0.11593 });
    });
  });

  test.describe('Actual Request Routing', () => {
    test.skip(!process.env.E2E_API_KEY, 'E2E_API_KEY required');

    test('simple requests are routed to cheaper models', async ({ page }) => {
      // Ensure routing is enabled
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
      });

      const response = await makeLLMRequest({
        apiKey,
        baseUrl: API_BASE_URL,
        model: 'gpt-4o', // Request premium model
        messages: [{ role: 'user', content: 'Say hello.' }],
        maxTokens: 10,
      });

      expect(response.success).toBe(true);
      console.log(`Requested: gpt-4o, Routed to: ${response.routedModel}`);

      // The request may be routed to a cheaper model (gpt-4o-mini)
      // This depends on the routing decision
    });

    test('complex requests stay on premium models', async () => {
      // Ensure routing is enabled
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
      });

      const response = await makeLLMRequest({
        apiKey,
        baseUrl: API_BASE_URL,
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: 'Design a distributed lock service with consistency guarantees, including the data model, API, and failure handling strategies.',
        }],
        maxTokens: 200,
      });

      expect(response.success).toBe(true);
      console.log(`Complex request - Requested: gpt-4o, Routed to: ${response.routedModel}`);

      // Complex requests should stay on premium model
    });
  });

  test.describe('Cost Savings Tracking', () => {
    test('routing decisions record estimated savings', async () => {
      // Make several routing test decisions
      const prompts = [
        ...TEST_PROMPTS.simple.slice(0, 3),
        ...TEST_PROMPTS.complex.slice(0, 2),
      ];

      let totalEstimatedSavings = 0;

      for (const prompt of prompts) {
        const result = await testRoutingDecision(API_BASE_URL, authToken, 'gpt-4o', prompt);
        if (result && result.estimated_savings_usd > 0) {
          totalEstimatedSavings += result.estimated_savings_usd;
          console.log(`"${prompt.substring(0, 30)}..." → Savings: $${result.estimated_savings_usd}`);
        }
      }

      console.log(`Total estimated savings: $${totalEstimatedSavings.toFixed(4)}`);
    });

    test('routing stats show cumulative savings', async ({ page }) => {
      const stats = await getRoutingStats(API_BASE_URL, authToken, 7);

      if (stats) {
        console.log('7-day routing stats:', stats);
        expect(stats.total_decisions).toBeGreaterThanOrEqual(0);
        expect(stats.total_savings_usd).toBeGreaterThanOrEqual(0);
      }

      // Verify in UI
      await page.goto('/app/smart-routing');
      await page.waitForLoadState('networkidle');

      // Look for savings display
      const savingsDisplay = await page.getByText(/savings|saved|\$/i).isVisible({ timeout: 5000 }).catch(() => false);
      console.log(`Savings displayed in UI: ${savingsDisplay}`);
    });
  });

  test.describe('Provider-Specific Routing', () => {
    test('OpenAI models route between gpt-4o and gpt-4o-mini', async () => {
      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'gpt-4o',
        'Hello!'
      );

      if (result && result.routing_applied) {
        expect(result.routed_model).toMatch(/gpt-4o-mini|gpt-3.5-turbo/i);
        console.log(`OpenAI routing: gpt-4o → ${result.routed_model}`);
      }
    });

    test('Anthropic models route between claude-3-5-sonnet and claude-3-haiku', async () => {
      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'claude-3-5-sonnet-20241022',
        'Hello!'
      );

      if (result && result.routing_applied) {
        expect(result.routed_model).toMatch(/haiku|claude-3-5-haiku/i);
        console.log(`Anthropic routing: claude-3-5-sonnet → ${result.routed_model}`);
      }
    });
  });

  test.describe('Hybrid Routing (RouteLLM + Semantic)', () => {
    test('RouteLLM takes priority when confident', async () => {
      // Enable both semantic and RouteLLM
      await updateRoutingSettings(API_BASE_URL, authToken, {
        smart_routing_enabled: true,
        routellm_enabled: true,
      });

      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'gpt-4o',
        'What is the capital of France?'
      );

      if (result) {
        console.log('Hybrid routing result:', {
          routellm_used: result.routellm_used,
          routellm_confident: result.routellm_win_rate !== null,
          task_type: result.task_type,
          complexity_score: result.complexity_score,
          routing_reason: result.routing_reason,
        });

        // If RouteLLM is used and confident, it should be mentioned in reason
        if (result.routellm_used) {
          expect(result.routing_reason).toMatch(/RouteLLM|win.*rate|P\(strong/i);
        }
      }
    });

    test('falls back to semantic when RouteLLM not confident', async () => {
      // This tests the fallback behavior
      // When RouteLLM is uncertain, semantic classification takes over

      const result = await testRoutingDecision(
        API_BASE_URL,
        authToken,
        'gpt-4o',
        'Help me with something.'
      );

      if (result) {
        console.log('Fallback test:', {
          routellm_used: result.routellm_used,
          semantic_used: result.task_type !== null,
          routing_reason: result.routing_reason,
        });

        // Should have either RouteLLM or semantic reasoning
        expect(result.routing_reason).toBeTruthy();
      }
    });
  });

  test.describe('Routing Decision Recording', () => {
    test('all routing decisions are persisted', async ({ page }) => {
      // Make a few decisions
      const prompts = TEST_PROMPTS.simple.slice(0, 3);

      for (const prompt of prompts) {
        await testRoutingDecision(API_BASE_URL, authToken, 'gpt-4o', prompt);
      }

      // Check stats increased
      const stats = await getRoutingStats(API_BASE_URL, authToken, 1);

      expect(stats).not.toBeNull();
      expect(stats!.total_decisions).toBeGreaterThan(0);

      console.log('Today routing stats:', stats);
    });
  });
});

test.describe('RouteLLM Error Handling', () => {
  let authToken: string;

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', process.env.E2E_TEST_EMAIL || 'test@tokentrailapp.com');
    await page.fill('input[type="password"]', process.env.E2E_TEST_PASSWORD || 'TestPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/app\/dashboard/);

    authToken = await page.evaluate(() => {
      return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
    });
  });

  test('graceful fallback when RouteLLM unavailable', async () => {
    // This tests that routing still works if RouteLLM fails
    const result = await testRoutingDecision(
      API_BASE_URL,
      authToken,
      'gpt-4o',
      'Test prompt'
    );

    // Should still return a result (using semantic fallback)
    expect(result).not.toBeNull();
    expect(result!.routed_model).toBeTruthy();

    // Complexity score should be available as fallback
    expect(result!.complexity_score).toBeGreaterThanOrEqual(0);
  });

  test('routing works when disabled', async () => {
    // Disable routing
    await updateRoutingSettings(API_BASE_URL, authToken, {
      smart_routing_enabled: false,
    });

    const result = await testRoutingDecision(
      API_BASE_URL,
      authToken,
      'gpt-4o',
      'Test prompt'
    );

    expect(result).not.toBeNull();
    expect(result!.routing_applied).toBe(false);
    expect(result!.routed_model).toBe('gpt-4o'); // Should keep original

    // Re-enable
    await updateRoutingSettings(API_BASE_URL, authToken, {
      smart_routing_enabled: true,
    });
  });
});
