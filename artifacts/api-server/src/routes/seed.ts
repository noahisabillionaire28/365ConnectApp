/**
 * Seed — creates the test account + 8 demo shifts in Supabase.
 *
 * Only runs in development (NODE_ENV !== 'production').
 * Requires SUPABASE_SERVICE_ROLE_KEY; silently skips if not set.
 *
 * Shifts use deterministic UUIDs so re-runs are idempotent.
 */

const TEST_EMAIL    = 'test@365connect.com';
const TEST_USERNAME = 'test_user';

// ─── Deterministic UUIDs for the 8 demo shifts ───────────────────────────────
const SHIFT_IDS = [
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
];

function addHours(base: Date, h: number): string {
  return new Date(base.getTime() + h * 60 * 60 * 1000).toISOString();
}

function startOfDayPlusDays(days: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function buildShifts(clientId: string) {
  return [
    {
      id:                '00000000-0000-0000-0000-000000000001',
      client_id:         clientId,
      title:             'Bartender — The Rooftop Bar',
      job_type:          'Bartender',
      job_types:         ['Bartender'],
      company_name:      'The Rooftop Bar',
      description:       'High-volume craft cocktail bar atop the 1 Hotel South Beach. Looking for experienced bartenders comfortable with speed and precision during peak rooftop service hours.',
      location:          'Miami Beach, FL',
      lat:               25.7825,
      lng:               -80.1298,
      hourly_rate:       35,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(0, 21).toISOString(),
      end_time:          addHours(startOfDayPlusDays(0, 21), 6),
      spots:             4,
      spots_filled:      2,
      status:            'open',
      ai_match_pct:      97,
      requirements:      ['2+ yrs bartending', 'Craft cocktail knowledge', 'TIPS certified'],
      dress_code:        'All black uniform provided',
      dress_code_items:  ['All Black', 'Black Dress Shirt', 'Black Slacks', 'Black Non-Slip Shoes', 'Black Belt', 'No Visible Tattoos'],
      point_of_contact:  'Samantha Cruz',
      contact_phone:     '(305) 555-0142',
      cover_image:       'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000002',
      client_id:         clientId,
      title:             'Cocktail Server — Grand Hyatt Gala',
      job_type:          'Cocktail Server',
      job_types:         ['Cocktail Server'],
      company_name:      'Grand Hyatt Gala',
      description:       'Corporate gala for 400 guests at the Grand Hyatt Ballroom. Seeking polished cocktail servers for a black-tie charity event benefiting youth arts programs.',
      location:          'Downtown Miami, FL',
      lat:               25.7637,
      lng:               -80.1915,
      hourly_rate:       28,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(1, 19).toISOString(),
      end_time:          addHours(startOfDayPlusDays(1, 19), 6),
      spots:             10,
      spots_filled:      5,
      status:            'open',
      ai_match_pct:      91,
      requirements:      ['Fine dining experience', 'Professional demeanor', 'English + Spanish preferred'],
      dress_code:        'Black tie — formal wear provided',
      dress_code_items:  ['Black Tuxedo', 'White Dress Shirt', 'Black Bow Tie', 'Black Dress Pants', 'Black Dress Shoes', 'Black Belt'],
      point_of_contact:  'James Whitfield',
      contact_phone:     '(305) 555-0267',
      cover_image:       'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000003',
      client_id:         clientId,
      title:             'Security — LIV Nightclub',
      job_type:          'Security',
      job_types:         ['Security'],
      company_name:      'LIV Nightclub',
      description:       'LIV is seeking experienced crowd-control security for a sold-out DJ residency. Must be comfortable managing VIP lines and guest de-escalation in a high-energy nightlife environment.',
      location:          'Miami Beach, FL',
      lat:               25.791,
      lng:               -80.1285,
      hourly_rate:       25,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(2, 22).toISOString(),
      end_time:          addHours(startOfDayPlusDays(2, 22), 6),
      spots:             6,
      spots_filled:      4,
      status:            'open',
      ai_match_pct:      84,
      requirements:      ['G License (FL)', '200 lbs+ preferred', 'Nightclub experience'],
      dress_code:        'Black LIV polo + black slacks',
      dress_code_items:  ['Black LIV Polo (Provided)', 'Black Cargo Pants', 'Black Boots', 'Black Cap (Optional)', 'No Jewelry'],
      point_of_contact:  'Ricardo Vega',
      contact_phone:     '(305) 555-0381',
      cover_image:       'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000004',
      client_id:         clientId,
      title:             'Brand Ambassador — Nike Launch Event',
      job_type:          'Brand Ambassador',
      job_types:         ['Brand Ambassador'],
      company_name:      'Nike Launch Event',
      description:       'Nike Footwear is launching the Air Max 2026 in Wynwood. Looking for outgoing, fashion-forward brand ambassadors to engage consumers, distribute samples, and capture social content.',
      location:          'Wynwood, FL',
      lat:               25.8011,
      lng:               -80.1985,
      hourly_rate:       30,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(3, 12).toISOString(),
      end_time:          addHours(startOfDayPlusDays(3, 12), 8),
      spots:             12,
      spots_filled:      4,
      status:            'open',
      ai_match_pct:      88,
      requirements:      ['Outgoing personality', 'Social media presence preferred', 'Bilingual a plus'],
      dress_code:        'Casual — Nike gear provided',
      dress_code_items:  ['Nike Tee (Provided)', 'Nike Joggers (Provided)', 'Air Max 2026 (Provided)', 'Clean White Sneakers'],
      point_of_contact:  'Tasha Monroe',
      contact_phone:     '(305) 555-0445',
      cover_image:       'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000005',
      client_id:         clientId,
      title:             'Event Setup — Art Basel Miami',
      job_type:          'Event Setup',
      job_types:         ['Event Setup'],
      company_name:      'Art Basel Miami',
      description:       'Setup crew needed for the premier contemporary art fair. Tasks include booth assembly, art hanging assistance, signage installation, and venue prep.',
      location:          'Miami Beach Conv. Ctr.',
      lat:               25.7928,
      lng:               -80.131,
      hourly_rate:       22,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(4, 7).toISOString(),
      end_time:          addHours(startOfDayPlusDays(4, 7), 8),
      spots:             20,
      spots_filled:      8,
      status:            'open',
      ai_match_pct:      79,
      requirements:      ['Physical stamina', 'Attention to detail', 'Team player'],
      dress_code:        'Comfortable work clothes + closed-toe shoes',
      dress_code_items:  ['Comfortable Work Clothes', 'Closed-Toe Shoes', 'High-Vis Vest (Provided)', 'Work Gloves (Provided)', 'No Open-Toe Shoes'],
      point_of_contact:  'Luis Fontaine',
      contact_phone:     '(305) 555-0523',
      cover_image:       'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000006',
      client_id:         clientId,
      title:             'Catering Lead — Private Estate',
      job_type:          'Catering Lead',
      job_types:         ['Catering Lead'],
      company_name:      'Private Estate',
      description:       'Intimate dinner for 30 guests at a private Coral Gables estate. We need an experienced catering lead to oversee plated service, coordinate the kitchen team, and ensure impeccable presentation for UHNW clientele.',
      location:          'Coral Gables, FL',
      lat:               25.7218,
      lng:               -80.2681,
      hourly_rate:       42,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(5, 17).toISOString(),
      end_time:          addHours(startOfDayPlusDays(5, 17), 6),
      spots:             2,
      spots_filled:      1,
      status:            'open',
      ai_match_pct:      93,
      requirements:      ['Fine dining lead experience', 'Wine knowledge', 'Reliable transportation'],
      dress_code:        'Formal — white glove service',
      dress_code_items:  ['White Gloves', 'White Dress Shirt', 'Black Vest', 'Black Dress Pants', 'Black Dress Shoes', 'Black Belt'],
      point_of_contact:  'Elena Marchetti',
      contact_phone:     '(305) 555-0689',
      cover_image:       'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000007',
      client_id:         clientId,
      title:             'Host / Hostess — NoMad Restaurant',
      job_type:          'Host / Hostess',
      job_types:         ['Host / Hostess'],
      company_name:      'NoMad Restaurant',
      description:       'NoMad Miami is seeking a warm, polished host or hostess for a busy Monday dinner service. You will manage reservations via SevenRooms, greet guests, and coordinate seating for a 180-cover dining room.',
      location:          'Brickell, Miami, FL',
      lat:               25.7632,
      lng:               -80.197,
      hourly_rate:       26,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(6, 17, 30).toISOString(),
      end_time:          addHours(startOfDayPlusDays(6, 17, 30), 6),
      spots:             4,
      spots_filled:      1,
      status:            'open',
      ai_match_pct:      86,
      requirements:      ['SevenRooms or OpenTable experience', 'Hospitality degree a plus', 'Fluent English'],
      dress_code:        'All-black professional attire',
      dress_code_items:  ['All Black', 'Black Blouse or Dress Shirt', 'Black Slacks or Skirt', 'Black Heels or Dress Shoes', 'Minimal Jewelry'],
      point_of_contact:  'Natalie Osei',
      contact_phone:     '(305) 555-0712',
      cover_image:       'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
    {
      id:                '00000000-0000-0000-0000-000000000008',
      client_id:         clientId,
      title:             'VIP Server — Fontainebleau Hotel',
      job_type:          'VIP Server',
      job_types:         ['VIP Server'],
      company_name:      'Fontainebleau Hotel',
      description:       'The iconic Fontainebleau is seeking VIP servers for LIV pool party weekend. Handle high-profile table service, bottle presentations, and celebrity guest relations with professionalism and discretion.',
      location:          'Miami Beach, FL',
      lat:               25.8134,
      lng:               -80.1218,
      hourly_rate:       34,
      pay_period:        'hr',
      start_time:        startOfDayPlusDays(7, 20).toISOString(),
      end_time:          addHours(startOfDayPlusDays(7, 20), 6),
      spots:             8,
      spots_filled:      4,
      status:            'open',
      ai_match_pct:      90,
      requirements:      ['VIP/bottle service experience', 'Upbeat professional attitude', 'TIPS certified'],
      dress_code:        'Fontainebleau uniform provided',
      dress_code_items:  ['Fontainebleau Uniform (Provided)', 'Black Non-Slip Shoes', 'Hair Tied Back', 'Minimal Accessories', 'Clean Shaven or Neat Beard'],
      point_of_contact:  'David Park',
      contact_phone:     '(305) 555-0835',
      cover_image:       'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
      repeat_type:       'once',
    },
  ];
}

async function seedShifts(
  clientId: string,
  supabaseUrl: string,
  authHeaders: Record<string, string>,
): Promise<void> {
  const shifts = buildShifts(clientId);

  const res = await fetch(`${supabaseUrl}/rest/v1/shifts`, {
    method:  'POST',
    headers: {
      ...authHeaders,
      'Prefer': 'resolution=merge-duplicates',
    },
    body: JSON.stringify(shifts),
  });

  if (res.ok || res.status === 201) {
    console.log(`[Seed] ✅ ${shifts.length} demo shifts upserted`);
  } else {
    const body = await res.text();
    if (body.includes('does not exist') || body.includes('column')) {
      console.warn('[Seed] ⚠️  shifts table missing extended columns — run Phase 2 of supabase/schema.sql first');
    } else {
      console.warn(`[Seed] ⚠️  Shift upsert failed: ${res.status} — ${body.slice(0, 200)}`);
    }
  }
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function seedTestUser(): Promise<{ ok: boolean; message: string }> {
  if (process.env['NODE_ENV'] === 'production') {
    return { ok: false, message: 'Seed skipped — not allowed in production' };
  }

  const supabaseUrl    = process.env['VITE_SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !serviceRoleKey) {
    return { ok: false, message: 'Supabase credentials not available — skipping seed' };
  }

  const testPassword = process.env['SEED_TEST_PASSWORD'];
  if (!testPassword) {
    return { ok: false, message: 'SEED_TEST_PASSWORD not set — skipping seed' };
  }

  const authHeaders = {
    'Content-Type':  'application/json',
    'apikey':        serviceRoleKey,
    'Authorization': `Bearer ${serviceRoleKey}`,
  };

  // ── 1. Create / look up auth user ────────────────────────────────────────────
  let userId: string | null = null;

  const createRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method:  'POST',
    headers: authHeaders,
    body: JSON.stringify({
      email:         TEST_EMAIL,
      password:      testPassword,
      email_confirm: true,
    }),
  });

  if (createRes.ok) {
    const body = await createRes.json() as { id: string };
    userId = body.id;
    console.log(`[Seed] ✅ Created auth user ${TEST_EMAIL} (${userId})`);
  } else if (createRes.status === 422) {
    const listRes = await fetch(
      `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(TEST_EMAIL)}&per_page=1`,
      { headers: authHeaders },
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
    void err; // avoid logging — may contain sensitive data
    console.warn(`[Seed] ⚠️  Could not create auth user: ${createRes.status}`);
    return { ok: false, message: `Auth user creation failed: ${createRes.status}` };
  }

  if (!userId) {
    return { ok: false, message: 'Could not determine user ID for test account' };
  }

  // ── 2. Upsert users table row ─────────────────────────────────────────────────
  const profileRes = await fetch(`${supabaseUrl}/rest/v1/users`, {
    method:  'POST',
    headers: { ...authHeaders, 'Prefer': 'resolution=merge-duplicates' },
    body: JSON.stringify({
      id:             userId,
      email:          TEST_EMAIL,
      role:           'client',           // client so they can post shifts
      username:       TEST_USERNAME,
      bio:            'Test account — 365 Connect',
      job_types:      ['Bartender', 'Server'],
      certifications: [],
      rating:         0,
    }),
  });

  if (!profileRes.ok && profileRes.status !== 201) {
    const errBody = await profileRes.text();
    if (errBody.includes('does not exist') || errBody.includes('relation')) {
      console.warn('[Seed] ⚠️  users table not found — run supabase/schema.sql in the Supabase SQL editor first');
      return { ok: false, message: 'users table missing — run supabase/schema.sql in the Supabase SQL editor' };
    }
    console.warn(`[Seed] ⚠️  Could not upsert profile: ${profileRes.status}`);
    return { ok: false, message: `Profile upsert failed: ${profileRes.status}` };
  }

  console.log(`[Seed] ✅ Test user profile ready (username: ${TEST_USERNAME})`);

  // ── 3. Seed demo shifts ───────────────────────────────────────────────────────
  await seedShifts(userId, supabaseUrl, authHeaders);

  return { ok: true, message: 'Test user + demo shifts ready' };
}

void SHIFT_IDS; // silence unused warning
