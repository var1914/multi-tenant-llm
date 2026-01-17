import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: false, // Run tests sequentially for E2E
  retries: 0,
  workers: 1,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 180000, // 3 minutes per test for demo mode

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Run in headed mode for visibility
    headless: false,
    viewport: null, // Use full window size
    launchOptions: {
      slowMo: 800, // Slower for demo visibility
      args: ['--start-maximized'], // Start browser maximized
    },
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        headless: false,
        viewport: null, // Full screen
        launchOptions: {
          args: ['--start-maximized', '--start-fullscreen'],
          slowMo: 800,
        },
      },
    },
    {
      name: 'demo',
      use: {
        headless: false,
        viewport: { width: 1920, height: 1080 }, // Full HD for demo
        video: {
          mode: 'on',
          size: { width: 1920, height: 1080 }, // Record at 1080p
        },
        launchOptions: {
          args: [
            '--start-maximized',
            '--start-fullscreen',
            '--window-size=1920,1080',
            '--force-device-scale-factor=1',
          ],
          slowMo: 1200, // Slower for narration sync
        },
      },
    },
    {
      name: 'demo-4k',
      use: {
        headless: false,
        viewport: { width: 2560, height: 1440 }, // 2K/QHD
        video: {
          mode: 'on',
          size: { width: 2560, height: 1440 },
        },
        launchOptions: {
          args: [
            '--start-maximized',
            '--window-size=2560,1440',
            '--force-device-scale-factor=1',
          ],
          slowMo: 1200,
        },
      },
    },
  ],

  // Run your local dev server before starting the tests
  webServer: {
    command: 'echo "Using existing dev server"',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
});
