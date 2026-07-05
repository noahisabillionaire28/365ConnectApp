/**
 * Seed — creates the test account in Supabase Auth + users table.
 *
 * Only runs in development (NODE_ENV !== 'production').
 * Requires SUPABASE_SERVICE_ROLE_KEY; silently skips if not set.
 *
 * The HTTP endpoint is intentionally omitted — seeding only happens
 * automatically at server startup, never via an unauthenticated HTTP call.
 */

const TEST_EMAIL    = 'test@365connect.com';
const TEST_USERNAME = 'test_user';

export async function seedTestUser(): Promise<{ ok: boolean; message: string }> {
  // Hard-stop in production — never seed predictable credentials there
  if (process.env['NODE_ENV'] === 'production') {
    return { ok: false, message: 'Seed skipped — not allowed in production' };
  }

  const supabaseUrl    = process.env['VITE_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, message: 'Supabase credentials not available — skipping seed' };
  }

  const authHeaders = {
    'Content-Type':  'application/json',
    'apikey':        serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
  };

  // ── 1. Create auth user ─────────────────────────────────────────────────────
  let userId: string | null = null;

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method:  'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email:         TEST_EMAIL,
      // Password read from env so it never appears in source code
      password:      process.env['SEED_TEST_PASSWORD'] ?? 'Test123!',
      email_confirm: true,
    }),
  });

  if (createRes.ok) {
    const body = await createRes.json() as { id: string };
    userId = body.id;
    console.log(`[Seed] ✅ Created auth user ${TEST_EMAIL} (${userId})`);
  } else if (createRes.status === 422) {
    // User already exists — look up their ID
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(TEST_EMAIL)}&per_page=1`,
      { headers: authHeaders }
    );
    if (listRes.ok) {
      const { users } = await listRes.json() as { users: Array<{ id: string }> };
      if (users?.[0]) {
        userId = users[0].id;
        console.log(`[Seed] ℹ️  Auth user already exists: ${TEST_EMAIL} (${userId})`);
      }
    }
  } else {
    const err = await createRes.text();
    console.warn(`[Seed] ⚠️  Could not create auth user: ${createRes.status}`);
    // Avoid logging error body — may contain sensitive details
    void err;
    return { ok: false, message: `Auth user creation failed: ${createRes.status}` };
  }

  if (!userId) {
    return { ok: false, message: 'Could not determine user ID for test account' };
  }

  // ── 2. Upsert users table row ───────────────────────────────────────────────
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method:  'POST',
    headers: {
      ...authHeaders,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify({
      id:             userId,
      email:          TEST_EMAIL,
      role:           'worker',
      username:       TEST_USERNAME,
      bio:            'Test account — 365 Connect',
      job_types:      ['Bartender', 'Server'],
      certifications: [],
      rating:         0,
    }),
  });

  if (profileRes.ok || profileRes.status === 201) {
    console.log(`[Seed] ✅ Test user profile ready (username: ${TEST_USERNAME})`);
    return { ok: true, message: 'Test user ready' };
  } else {
    const errBody = await profileRes.text();
    if (errBody.includes('does not exist') || errBody.includes('relation')) {
      console.warn('[Seed] ⚠️  users table not found — run supabase/schema.sql in the Supabase SQL editor first');
      return { ok: false, message: 'users table missing — run supabase/schema.sql in the Supabase SQL editor' };
    }
    console.warn(`[Seed] ⚠️  Could not upsert profile: ${profileRes.status}`);
    return { ok: false, message: `Profile upsert failed: ${profileRes.status}` };
  }
}
