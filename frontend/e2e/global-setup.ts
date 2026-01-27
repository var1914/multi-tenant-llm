import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Global setup for Playwright tests
 * Creates necessary directories and validates environment
 */
async function globalSetup(config: FullConfig) {
  // Create auth directory if it doesn't exist
  const authDir = path.join(__dirname, 'playwright', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  // Validate required environment variables
  const baseURL = process.env.E2E_BASE_URL || 'https://tokentrailapp.com';
  console.log(`\n🚀 Running E2E tests against: ${baseURL}\n`);

  // Validate test credentials are set
  if (!process.env.E2E_TEST_EMAIL || !process.env.E2E_TEST_PASSWORD) {
    console.warn('⚠️  E2E_TEST_EMAIL and E2E_TEST_PASSWORD not set.');
    console.warn('   Using default test credentials.\n');
  }
}

export default globalSetup;
