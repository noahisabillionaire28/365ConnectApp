/**
 * Playwright global setup — authenticates the seeded test account by:
 *   1. Generating a one-time magic-link token via the Supabase admin API
 *   2. Exchanging it directly for an access/refresh token pair (REST — no browser redirect)
 *   3. Injecting the session into the browser's localStorage for http://localhost:PORT
 *   4. Navigating to /home and saving the storage state for all downstream tests
 *
 * This avoids the origin-mismatch that happens when Supabase redirects back to
 * the public Replit preview domain instead of localhost.
 *
 * Required env vars (all present as Replit Secrets):
 *   VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY
 */
import { chromium, type FullConfig } from '@playwright/test';
import * as fs   from 'node:fs';
import * as path from 'node:path';

const TEST_EMAIL = 'test@365connect.com';

export default async function globalSetup(_config: FullConfig) {
  const supabaseUrl = process.env['VITE_SUPABASE_URL'];
  const serviceKey  = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  const anonKey     = process.env['VITE_SUPABASE_ANON_KEY'];
  const port        = process.env['PORT'] ?? '25836';
  const baseURL     = `http://localhost:${port}`;

  if (!supabaseUrl || !serviceKey || !anonKey) {
    throw new Error(
      'global-setup: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and ' +
      'VITE_SUPABASE_ANON_KEY must all be set.',
    );
  }

  // ── 1. Generate a magic-link token ────────────────────────────────────────
  const linkRes = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method:  'POST',
    headers: {
      'Content-Type':  'application/json',
      'apikey':        serviceKey,
      'Authorization': `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      type:        'magiclink',
      email:       TEST_EMAIL,
      redirect_to: `${baseURL}/`,
    }),
  });

  if (!linkRes.ok) {
    const body = await linkRes.text();
    throw new Error(`global-setup: generate_link failed (${linkRes.status}): ${body}`);
  }

  const { action_link } = await linkRes.json() as { action_link: string };

  // The action_link contains either `token` or `token_hash` in its query string.
  const actionUrl   = new URL(action_link);
  const tokenHash   = actionUrl.searchParams.get('token_hash') ?? actionUrl.searchParams.get('token');
  if (!tokenHash) throw new Error(`global-setup: no token/token_hash in action_link: ${action_link}`);

  // ── 2. Exchange the token for a live session directly (no browser redirect) ──
  const verifyRes = await fetch(`${supabaseUrl}/auth/v1/verify`, {
    method:  'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey':        anonKey,
    },
    body: JSON.stringify({ token_hash: tokenHash, type: 'magiclink' }),
  });

  if (!verifyRes.ok) {
    const body = await verifyRes.text();
    throw new Error(`global-setup: /auth/v1/verify failed (${verifyRes.status}): ${body}`);
  }

  const session = await verifyRes.json() as {
    access_token:  string;
    refresh_token: string;
    expires_in:    number;
    token_type:    string;
    user:          object;
  };

  // ── 3. Inject session into the browser's localStorage for localhost ─────────
  // Supabase JS v2 stores the session under: sb-<projectRef>-auth-token
  // Extract project ref from the URL: https://<ref>.supabase.co
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0];
  const lsKey      = `sb-${projectRef}-auth-token`;
  const lsValue    = JSON.stringify({
    access_token:   session.access_token,
    token_type:     session.token_type,
    expires_in:     session.expires_in,
    expires_at:     Math.floor(Date.now() / 1000) + session.expires_in,
    refresh_token:  session.refresh_token,
    user:           session.user,
  });

  const browser = await chromium.launch();
  const ctx     = await browser.newContext({ baseURL });
  const page    = await ctx.newPage();

  // Navigate to the app first so the origin is correct, then inject
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(
    ([key, value]) => { localStorage.setItem(key, value); },
    [lsKey, lsValue],
  );

  // Reload so Supabase JS picks up the injected session
  await page.goto('/', { waitUntil: 'networkidle', timeout: 20_000 });
  // SplashScreen's useEffect redirects authenticated users to /home
  await page.waitForURL(/\/home$/, { timeout: 20_000 });

  // ── 4. Persist storage state ───────────────────────────────────────────────
  const authDir   = path.join(process.cwd(), 'e2e', '.auth');
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  const stateFile = path.join(authDir, 'user.json');
  await ctx.storageState({ path: stateFile });

  await browser.close();
  console.log('[global-setup] ✅ Session injected — storage state saved for http://localhost');
}
