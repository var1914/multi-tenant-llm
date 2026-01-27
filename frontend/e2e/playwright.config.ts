import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auth state file path (absolute)
const authFile = path.join(__dirname, 'playwright', '.auth', 'user.json');

/**
 * TokenTrail E2E Test Configuration
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  // Run tests in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Stop after failures
  maxFailures: 10,

  // Use multiple workers for faster execution
  workers: process.env.CI ? 2 : 4,

  // Reporter to use
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],

  // Shared settings for all the projects below
  use: {
    // Base URL for all tests
    baseURL: process.env.E2E_BASE_URL || 'https://tokentrailapp.com',

    // Collect trace when retrying the failed test
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on failure
    video: 'on-first-retry',

    // Timeout for each action
    actionTimeout: 15000,

    // Timeout for navigation
    navigationTimeout: 30000,
  },

  // Global timeout for each test
  timeout: 60000,

  // Global setup/teardown
  globalSetup: './global-setup.ts',

  // Configure projects for major browsers
  projects: [
    // Setup project - runs first to authenticate
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },

    // Desktop Chrome
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },

    // Desktop Safari
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },

    // Mobile Chrome
    {
      name: 'Mobile Chrome',
      use: {
        ...devices['Pixel 5'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },

    // Mobile Safari
    {
      name: 'Mobile Safari',
      use: {
        ...devices['iPhone 12'],
        storageState: authFile,
      },
      dependencies: ['setup'],
    },
  ],

  // Expect settings
  expect: {
    timeout: 10000,
  },
});
