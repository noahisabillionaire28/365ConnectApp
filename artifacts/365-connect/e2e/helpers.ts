import { expect, type Page } from '@playwright/test';

/** Seeded test account — see artifacts/api-server/src/routes/seed.ts */
export const TEST_EMAIL = 'test@365connect.com';

/**
 * Full splash → login form flow (used only by the splash/login smoke test).
 * Requires SEED_TEST_PASSWORD to be set and ≥ 6 characters.
 * All other tests use pre-saved storage state via global-setup.ts.
 */
export async function loginViaForm(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByTestId('input-email').fill(TEST_EMAIL);
  await page.getByTestId('input-password').fill(process.env['SEED_TEST_PASSWORD'] ?? '');
  await page.getByTestId('btn-login-submit').click();
  await page.waitForURL(/\/home$/, { timeout: 20_000 });
}
