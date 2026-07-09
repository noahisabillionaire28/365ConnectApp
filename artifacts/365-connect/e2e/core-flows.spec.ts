import { test, expect } from '@playwright/test';
import * as path from 'node:path';

/**
 * Smoke suite for the four key journeys:
 *   1. Splash screen UI + login form renders when not logged in
 *   2. Authenticated user lands on the home feed
 *   3. Tapping a shift card opens its detail screen
 *   4. The 5-step post-shift wizard completes and returns to /jobs
 *   5. Tapping a worker card on the home feed opens their profile
 *
 * Tests 1 use an empty (unauthenticated) storage state.
 * Tests 2–5 use the storage state written by global-setup.ts (magic-link auth).
 *
 * Test account: test@365connect.com, role: 'client', username: 'test_user'
 * 8 deterministic demo shifts seeded on API server boot.
 */

const AUTH_STATE = path.join(process.cwd(), 'e2e', '.auth', 'user.json');

// ── 1 & 2: Splash / login UI + home feed ──────────────────────────────────────

test.describe('splash screen (logged out)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('shows sign-up and log-in entry points', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByTestId('btn-splash-signup')).toBeVisible();
    await expect(page.getByTestId('btn-splash-login')).toBeVisible();
  });

  test('log-in button opens the login form with email + password fields', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('btn-splash-login').click();
    await page.waitForURL(/\/login$/);
    await expect(page.getByTestId('input-email')).toBeVisible();
    await expect(page.getByTestId('input-password')).toBeVisible();
    await expect(page.getByTestId('btn-login-submit')).toBeVisible();
  });
});

test.describe('home feed (authenticated)', () => {
  test.use({ storageState: AUTH_STATE });

  test('authenticated user visiting / is redirected to /home and sees the feed', async ({ page }) => {
    await page.goto('/');
    await page.waitForURL(/\/home$/, { timeout: 20_000 });
    // Client home feed header and worker discovery cards
    await expect(page.getByText('365 Connect').first()).toBeVisible();
    await expect(page.getByText('Discover workers')).toBeVisible();
    // Bottom nav confirms the app shell rendered
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();
  });
});

// ── 3: Shift detail ────────────────────────────────────────────────────────────

test.describe('shift detail', () => {
  test.use({ storageState: AUTH_STATE });

  test('tapping a shift card navigates to its detail screen', async ({ page }) => {
    await page.goto('/jobs');

    // The client's 8 seeded shifts load as article cards in the bottom sheet
    const firstCard = page.getByRole('article').first();
    await expect(firstCard).toBeVisible({ timeout: 20_000 });

    const label = await firstCard.getAttribute('aria-label');
    await firstCard.click();

    await page.waitForURL(/\/shift\/[0-9a-f-]+$/, { timeout: 10_000 });

    // The detail screen shows the same job type that was on the card
    if (label) {
      const jobType = label.split(' at ')[0];
      await expect(page.getByText(jobType, { exact: true }).first()).toBeVisible();
    }
  });
});

// ── 4: Post-shift wizard ───────────────────────────────────────────────────────

test.describe('post-shift wizard', () => {
  test.use({ storageState: AUTH_STATE });

  test('all 5 steps complete and the new shift detail screen opens', async ({ page }) => {
    // Step 1 — pick a job type and name the shift (both required)
    await page.goto('/post-shift/step1');
    await page.getByRole('button', { name: /^Select / }).first().click();
    await page.getByLabel('Shift title').fill('Playwright Test Shift');
    await page.getByRole('button', { name: 'Continue to location' }).click();
    await page.waitForURL(/\/post-shift\/step2$/);

    // Step 2 — location (required).
    // Use pressSequentially: the LocationAutocomplete uses defaultValue (uncontrolled)
    // and React only fires synthetic onChange reliably from per-character keystrokes.
    await page.getByLabel('Venue address or name').click();
    await page.keyboard.type('Miami Beach, FL');
    await page.getByRole('button', { name: 'Continue to schedule' }).click();
    await page.waitForURL(/\/post-shift\/step3$/);

    // Step 3 — date/time (date defaults to today, times pre-filled)
    await expect(page.getByLabel('Shift date')).toBeVisible();
    await page.getByRole('button', { name: 'Continue to pay and details' }).click();
    await page.waitForURL(/\/post-shift\/step4$/);

    // Step 4 — hourly pay rate (required)
    await page.getByLabel('Hourly pay rate in USD').fill('30');
    await page.getByRole('button', { name: 'Review shift before posting' }).click();
    await page.waitForURL(/\/post-shift\/step5$/);

    // Step 5 — review, then post; success navigates to the new shift's detail page
    const postBtn = page.getByRole('button', { name: 'Post this shift and make it live' });
    await expect(postBtn).toBeEnabled();
    await postBtn.click();
    await page.waitForURL(/\/shift\/[0-9a-f-]+$/, { timeout: 20_000 });
  });
});

// ── 5: Worker profile ──────────────────────────────────────────────────────────

test.describe('worker profile', () => {
  test.use({ storageState: AUTH_STATE });

  test('tapping a worker card on the home feed opens their profile', async ({ page }) => {
    await page.goto('/home');

    // Client home shows PeopleCards — each has a "View Profile" button
    const viewBtn = page.getByRole('button', { name: 'View Profile' }).first();
    await expect(viewBtn).toBeVisible({ timeout: 20_000 });
    await viewBtn.click();

    await page.waitForURL(/\/worker\/[^/]+$/, { timeout: 10_000 });
  });
});
