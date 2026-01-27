# TokenTrail E2E Tests

Comprehensive end-to-end tests for TokenTrail frontend using Playwright.

## Prerequisites

1. Install Playwright:
```bash
cd frontend
npm install -D @playwright/test
npx playwright install
```

2. Set environment variables:
```bash
export E2E_BASE_URL=https://tokentrailapp.com
export E2E_TEST_EMAIL=your-test@email.com
export E2E_TEST_PASSWORD=your-test-password
```

Or create a `.env.test` file:
```
E2E_BASE_URL=https://tokentrailapp.com
E2E_TEST_EMAIL=test@tokentrailapp.com
E2E_TEST_PASSWORD=TestPassword123!
E2E_TEST_COMPANY=E2E Test Company
```

## Running Tests

### Run all tests
```bash
npx playwright test --config=e2e/playwright.config.ts
```

### Run specific test file
```bash
npx playwright test e2e/tests/auth.spec.ts --config=e2e/playwright.config.ts
```

### Run tests in headed mode (see browser)
```bash
npx playwright test --headed --config=e2e/playwright.config.ts
```

### Run tests on specific browser
```bash
npx playwright test --project=chromium --config=e2e/playwright.config.ts
npx playwright test --project=firefox --config=e2e/playwright.config.ts
npx playwright test --project=webkit --config=e2e/playwright.config.ts
```

### Run tests with UI mode (interactive)
```bash
npx playwright test --ui --config=e2e/playwright.config.ts
```

### Run tests in debug mode
```bash
npx playwright test --debug --config=e2e/playwright.config.ts
```

## Test Reports

After running tests, view the HTML report:
```bash
npx playwright show-report e2e/playwright-report
```

## Test Structure

```
e2e/
├── playwright.config.ts     # Playwright configuration
├── global-setup.ts          # Global setup (create auth dir, validate env)
├── fixtures/
│   ├── test-fixtures.ts     # Page objects and test utilities
│   └── api-helpers.ts       # API helpers for real LLM/routing tests
├── tests/
│   ├── auth.setup.ts        # Authentication setup (runs first)
│   ├── auth.spec.ts         # Login, register, logout tests
│   ├── dashboard.spec.ts    # Dashboard page tests
│   ├── customers.spec.ts    # Customer management tests
│   ├── api-keys.spec.ts     # API keys management tests
│   ├── billing.spec.ts      # Billing and subscription tests
│   ├── smart-routing.spec.ts # Smart routing tests
│   ├── routellm-routing.spec.ts # RouteLLM ML routing tests
│   ├── scenarios.spec.ts    # Comprehensive scenario-based tests
│   ├── predictions.spec.ts  # Predictions and alerts tests
│   ├── workflows.spec.ts    # Agentic workflows tests
│   ├── analytics.spec.ts    # Analytics page tests
│   ├── user-journeys.spec.ts # User journey tests
│   └── settings.spec.ts     # Settings page tests
└── playwright/
    └── .auth/               # Saved authentication state
```

## Test Coverage

### Authentication
- Landing page display
- Login with valid/invalid credentials
- Registration with validation
- Logout functionality
- Protected route access
- Session persistence

### Dashboard
- Page load and stats display
- Charts and visualizations
- Activity feed
- Navigation to all pages

### Customers
- List display with sorting
- Create new customer
- Edit existing customer
- Delete customer with confirmation
- Budget management
- Search and filter

### API Keys
- List display
- Create new key
- Copy key to clipboard
- Delete key with confirmation
- Environment filtering

### Billing
- Current subscription display
- Usage overview
- Pricing plans display
- Plan selection (demo mode)
- Subscription management

### Smart Routing
- Routing toggle
- Strategy selection
- Test routing feature
- Statistics display
- Recent decisions table

### Predictions
- Forecasts display
- Alerts management
- Alert actions (acknowledge, resolve)
- Risk distribution

### Workflows
- Workflow overview stats
- Workflow list with filtering
- Workflow detail modal
- Agent performance tab

### Analytics
- Charts rendering
- Date range filtering
- Data tables
- Responsive design

### Settings
- Profile information
- Organization details
- API usage example

## Scenario-Based Tests (Real API)

The `scenarios.spec.ts` and `routellm-routing.spec.ts` files contain comprehensive tests that make **real API calls** to test complete user workflows.

### Required Environment Variables

For full scenario testing, set these additional variables:

```bash
# API Key for making LLM requests through TokenTrail proxy
export E2E_API_KEY=your_tokentrail_api_key

# (Optional) Pre-approved trial email for testing trial credits
export E2E_APPROVED_TRIAL_EMAIL=approved@test.com
```

### Scenario Test Coverage

**Trial Signup Journey:**
- Submit trial request → Admin approval → Registration → $5 credits applied

**Smart Routing / RouteLLM:**
- Enable routing configuration
- Simple prompts route to cheaper models
- Complex prompts stay on premium models
- RouteLLM win-rate predictions
- Cost savings tracking

**API Usage Tracking:**
- Real LLM requests are tracked
- Token counts are accurate
- Per-customer attribution works

**Budget Alerts:**
- Customer budget limits
- Alert generation
- Prediction forecasts

**Multi-Tenant Isolation:**
- API keys scoped to tenant
- Usage data isolated

### Running Scenario Tests

```bash
# Run only scenario tests
npx playwright test scenarios.spec.ts --config=e2e/playwright.config.ts

# Run RouteLLM routing tests
npx playwright test routellm-routing.spec.ts --config=e2e/playwright.config.ts

# Run with API key for full testing
E2E_API_KEY=your_key npx playwright test scenarios.spec.ts --config=e2e/playwright.config.ts
```

## Parallel Test Execution

Tests run in parallel by default. Authentication is handled by a setup project that runs first and saves the auth state.

## CI/CD Integration

For CI, use:
```bash
npx playwright test --config=e2e/playwright.config.ts --reporter=html,json
```

Environment variables can be set in CI secrets:
- `E2E_BASE_URL`
- `E2E_TEST_EMAIL`
- `E2E_TEST_PASSWORD`

## Troubleshooting

### Tests failing due to auth
Delete the auth state and re-run:
```bash
rm -rf e2e/playwright/.auth
npx playwright test --config=e2e/playwright.config.ts
```

### Flaky tests
Increase timeout in `playwright.config.ts` or use `test.slow()` for slow tests.

### Visual debugging
Use `--debug` flag or `page.pause()` in tests to stop and inspect.
