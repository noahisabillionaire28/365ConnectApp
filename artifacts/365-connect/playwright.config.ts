import { defineConfig, devices } from '@playwright/test';

const PORT     = process.env.PORT ?? '25836';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

/**
 * Playwright config for the 365 Connect e2e smoke suite.
 *
 * global-setup authenticates the seeded test account via a Supabase admin
 * magic link (no password needed) and saves the browser storage state to
 * e2e/.auth/user.json.  Tests that need an authenticated session set
 * `use.storageState` at the describe level; the splash/login UI test overrides
 * it to an empty state so it starts logged-out.
 */
export default defineConfig({
  testDir:       './e2e',
  globalSetup:   './e2e/global-setup.ts',
  timeout:       45_000,
  expect:        { timeout: 10_000 },
  fullyParallel: false,
  workers:       1,
  retries:       process.env.CI ? 1 : 0,
  reporter:      [['list']],
  use: {
    baseURL:    BASE_URL,
    trace:      'retain-on-failure',
    screenshot: 'only-on-failure',
    video:      'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command:             'pnpm run dev',
    url:                 BASE_URL,
    reuseExistingServer: true,
    timeout:             60_000,
    env: { PORT, BASE_PATH: '/' },
  },
});
