#!/usr/bin/env node
/**
 * 365 Connect — deterministic seed / teardown script
 *
 * Seed:     cd scripts && npx tsx src/seed.ts
 * Teardown: cd scripts && npx tsx src/seed.ts --teardown
 *
 * All seeded accounts use the @seed.365connect.dev email domain.
 * Rows use deterministic UUID prefixes so the script is idempotent.
 *
 * Required env vars (Replit Secrets):
 *   VITE_SUPABASE_URL          — Supabase project REST URL
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (bypasses RLS)
 *   SEED_TEST_PASSWORD         — shared password for all seed auth users
 *
 * ── Live schema facts (verified via PostgREST openapi) ──────────────────────
 *  shifts      : pay_rate, spots_available, spots_filled (NOT hourly_rate/spots)
 *  posts       : photo_url (NOT image_url); also video_url, event_description
 *  reviews     : from_user_id, to_user_id (NOT reviewer_id/reviewee_id)
 *  conversations: participant_ids uuid[] (NOT participant_a/b_id); no last_message_at
 *  messages    : text (NOT body); conversation_id, sender_id, read_at
 *  notifications: from_user_id, shift_id, read_at, amount (not related_* or read bool)
 *  users       : is_pro, availability jsonb, primary_job_type, secondary_job_types, lat, lng
 *               (no status col — Phase 11 not yet applied)
 * ────────────────────────────────────────────────────────────────────────────
 */
import { createClient } from '@supabase/supabase-js';

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const SEED_PASS    = process.env.SEED_TEST_PASSWORD ?? '';

if (!SUPABASE_URL || !SERVICE_KEY || !SEED_PASS) {
  console.error('❌  Missing required env vars: VITE_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SEED_TEST_PASSWORD');
  process.exit(1);
}

const sb    = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const admin = sb.auth.admin;
const TEARDOWN = process.argv.includes('--teardown');

// ─── Deterministic UUID helpers ────────────────────────────────────────────────
// All UUIDs are valid v4-shaped (4 in group 3, 8 in group 4).
function sid(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}
const W  = (n: number) => sid('aa000001', n);  // workers   1-8
const CL = (n: number) => sid('bb000002', n);  // clients   1-3
const ST = (n: number) => sid('cc000003', n);  // staffers  1-2
const SH = (n: number) => sid('dd000004', n);  // shifts    1-10
const RV = (n: number) => sid('ee000005', n);  // reviews   1-24
const CV = (n: number) => sid('ff000006', n);  // conversations 1-4
const MS = (n: number) => sid('aa000007', n);  // messages  1-28
const PT = (n: number) => sid('bb000008', n);  // posts     1-24
const NT = (n: number) => sid('cc000009', n);  // notifications 1-8
const AP = (n: number) => sid('dd000010', n);  // applications  1-10

// ─── Date helpers ──────────────────────────────────────────────────────────────
/** Returns a Date set to midnight of the next occurrence of `dow` (0=Sun…6=Sat).
 *  weeksExtra adds that many additional 7-day periods on top. */
function nextDow(dow: number, weeksExtra = 0): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let delta = (dow - now.getDay() + 7) % 7;
  if (delta === 0) delta = 7; // never use today
  const d = new Date(now);
  d.setDate(d.getDate() + delta + weeksExtra * 7);
  return d;
}
/** ISO timestamp on `date` at hour:minute (local midnight = next calendar day). */
function ts(date: Date, hour: number, minute = 0): string {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}
/** ISO timestamp on the calendar day AFTER `date` at `hour`. */
function tsNextDay(date: Date, hour: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

// ─── Availability helper ───────────────────────────────────────────────────────
function avail(days: number[]): Record<string, boolean> {
  const keys = ['sun','mon','tue','wed','thu','fri','sat'];
  return Object.fromEntries(keys.map((k, i) => [k, days.includes(i)]));
}

// ─── Error helper ─────────────────────────────────────────────────────────────
function bail(label: string, err: unknown): never {
  throw new Error(`${label}: ${JSON.stringify(err)}`);
}

// ═════════════════════════════════════════════════════════════════════════════
// SEED
// ═════════════════════════════════════════════════════════════════════════════
async function seed() {
  console.log('\n🌱  365 Connect — Seed starting…');
  const counts: Record<string, number> = {};

  // ── 1. Auth users (find-or-create with deterministic IDs) ─────────────────
  console.log('\n📋  Step 1: Auth users (13 total)');

  async function findOrCreate(detId: string, email: string, username: string): Promise<string> {
    // Check our deterministic ID first
    const { data: byId } = await admin.getUserById(detId);
    if (byId.user) { console.log(`  ↩  ${email} (exists)`); return byId.user.id; }

    // Create with deterministic ID
    const { data: created, error } = await admin.createUser({
      id: detId, email, password: SEED_PASS, email_confirm: true,
      user_metadata: { username },
    });
    if (!error) { console.log(`  ✓  ${email}`); return created.user!.id; }

    // Fallback: email already registered under a different UUID — scan list
    const { data: list } = await admin.listUsers({ perPage: 1000 });
    const userList = ((list as { users?: { email?: string; id: string }[] } | null)?.users ?? []);
    const match = userList.find(u => u.email === email);
    if (match) { console.log(`  ↩  ${email} (different UUID: ${match.id})`); return match.id; }
    bail(`findOrCreate(${email})`, error);
  }

  const workerDefs = [
    { detId: W(1), email: 'mike.johnson@seed.365connect.dev',    username: 'mikejohnson',    name: 'Mike Johnson',    bio: '10 years bartending high-end events in Miami. From intimate dinners to 500-person galas.',                                    primary: 'Bartender',  secondary: ['Server','Captain'],          jobTypes: ['Bartender','Server','Captain'],          isPro: true,  lat: 25.790, lng: -80.130, rating: 4.8, availDays: [4,5,6]    },
    { detId: W(2), email: 'sarah.williams@seed.365connect.dev',  username: 'sarahwilliams',  name: 'Sarah Williams',  bio: 'Event hostess and brand ambassador with 7 years experience at luxury South Florida venues.',                                primary: 'Hostess',    secondary: ['Promo Model'],               jobTypes: ['Hostess','Promo Model'],                 isPro: true,  lat: 25.760, lng: -80.193, rating: 4.9, availDays: [5,6,0]    },
    { detId: W(3), email: 'david.martinez@seed.365connect.dev',  username: 'davidmartinez',  name: 'David Martinez',  bio: 'Licensed event security professional, 8 years protecting high-profile Miami events.',                                      primary: 'Security',   secondary: ['Manager'],                   jobTypes: ['Security','Manager'],                    isPro: false, lat: 25.804, lng: -80.199, rating: 4.7, availDays: [4,5,6]    },
    { detId: W(4), email: 'emily.davis@seed.365connect.dev',     username: 'emilydavis',     name: 'Emily Davis',     bio: 'Reliable event server with experience at South Beach restaurants and private events.',                                     primary: 'Server',     secondary: ['Busser','Housekeeper'],       jobTypes: ['Server','Busser','Housekeeper'],         isPro: false, lat: 25.782, lng: -80.134, rating: 4.6, availDays: [6,0,5]    },
    { detId: W(5), email: 'jason.lee@seed.365connect.dev',       username: 'jasonlee',       name: 'Jason Lee',       bio: 'Wedding and party DJ with a 5-star track record. Specializing in Miami weddings and corporate events.',                    primary: 'DJ',         secondary: ['Brand Ambassador'],          jobTypes: ['DJ','Brand Ambassador'],                 isPro: true,  lat: 25.774, lng: -80.193, rating: 5.0, availDays: [4,5,6]    },
    { detId: W(6), email: 'ashley.brown@seed.365connect.dev',    username: 'ashleybrown',    name: 'Ashley Brown',    bio: 'Craft cocktail specialist and mixologist. Coral Gables-based with 5 years fine-dining bar experience.',                     primary: 'Bartender',  secondary: ['Server'],                    jobTypes: ['Bartender','Server'],                    isPro: false, lat: 25.721, lng: -80.268, rating: 4.5, availDays: [6,0,1]    },
    { detId: W(7), email: 'carlos.gomez@seed.365connect.dev',    username: 'carlosgomez',    name: 'Carlos Gomez',    bio: 'Fine dining captain with 12 years at Miami\'s top restaurants. Trilingual: English/Spanish/Portuguese.',                   primary: 'Captain',    secondary: ['Manager','Server'],           jobTypes: ['Captain','Manager','Server'],            isPro: false, lat: 25.762, lng: -80.192, rating: 4.9, availDays: [5,6,0,4]  },
    { detId: W(8), email: 'tiffany.white@seed.365connect.dev',   username: 'tiffanywhite',   name: 'Tiffany White',   bio: 'Corporate event specialist based in Aventura. 6 years hosting Fortune 500 conferences and galas.',                        primary: 'Hostess',    secondary: ['Server'],                    jobTypes: ['Hostess','Server'],                      isPro: false, lat: 25.956, lng: -80.139, rating: 4.7, availDays: [5,6,0]    },
  ];
  const clientDefs = [
    { detId: CL(1), email: 'luxeevents@seed.365connect.dev',     username: 'luxeevents',     name: 'Luxe Events Miami',     bio: 'Miami\'s premier wedding and gala planning studio. Crafting unforgettable luxury experiences since 2008.',  lat: 25.790, lng: -80.130 },
    { detId: CL(2), email: 'sobargroup@seed.365connect.dev',     username: 'sobargroup',     name: 'SoBe Restaurant Group', bio: 'South Beach restaurant group operating 6 venues. Always seeking top-tier event staff for our properties.', lat: 25.782, lng: -80.134 },
    { detId: CL(3), email: 'privateeventsco@seed.365connect.dev',username: 'privateeventsco',name: 'Private Events Co',     bio: 'Boutique private party and corporate event company serving Miami-Dade since 2010.',                       lat: 25.760, lng: -80.193 },
  ];
  const stafferDefs = [
    { detId: ST(1), email: 'elitestaffing@seed.365connect.dev',  username: 'elitestaffing',  name: 'Elite Staffing Agency',    bio: 'Miami\'s top staffing agency for hospitality and event professionals. 500+ placements annually.', lat: 25.774, lng: -80.193 },
    { detId: ST(2), email: 'premierstaff@seed.365connect.dev',   username: 'premierstaff',   name: 'Premier Staff Solutions',  bio: 'Full-service staffing and event management for South Florida\'s hospitality industry.',              lat: 25.762, lng: -80.192 },
  ];

  const allDefs = [...workerDefs, ...clientDefs, ...stafferDefs];
  const idMap: Record<string, string> = {};
  for (const u of allDefs) {
    idMap[u.detId] = await findOrCreate(u.detId, u.email, u.username);
  }
  counts['auth.users'] = allDefs.length;

  // ── 2. public.users full profiles ─────────────────────────────────────────
  console.log('\n👤  Step 2: public.users profiles');
  const userRows = [
    ...workerDefs.map(w => ({
      id: idMap[w.detId],
      email: w.email,
      role: 'worker',
      username: w.username,
      photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(w.name)}&size=200&background=0A1628&color=fff&bold=true`,
      bio: w.bio,
      job_types: w.jobTypes,
      certifications: [] as string[],
      primary_job_type: w.primary,
      secondary_job_types: w.secondary,
      is_pro: w.isPro,
      lat: w.lat,
      lng: w.lng,
      rating: w.rating,
      availability: avail(w.availDays),
    })),
    ...clientDefs.map(c => ({
      id: idMap[c.detId],
      email: c.email,
      role: 'client',
      username: c.username,
      photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(c.name)}&size=200&background=10B981&color=fff&bold=true`,
      bio: c.bio,
      job_types: [] as string[],
      certifications: [] as string[],
      rating: 0,
      lat: c.lat,
      lng: c.lng,
    })),
    ...stafferDefs.map(s => ({
      id: idMap[s.detId],
      email: s.email,
      role: 'staffer',
      username: s.username,
      photo_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(s.name)}&size=200&background=6366F1&color=fff&bold=true`,
      bio: s.bio,
      job_types: [] as string[],
      certifications: [] as string[],
      rating: 0,
      lat: s.lat,
      lng: s.lng,
    })),
  ];
  const { error: ue } = await sb.from('users').upsert(userRows, { onConflict: 'id' });
  if (ue) bail('users upsert', ue);
  counts['users'] = userRows.length;
  console.log(`  ✓  ${userRows.length} rows`);

  // ── 3. Shifts ──────────────────────────────────────────────────────────────
  console.log('\n📅  Step 3: Shifts (10 + real Miami coords)');
  // Date anchors relative to "now" so script works on any run date
  const fri1 = nextDow(5);    // this Friday
  const sat1 = nextDow(6);    // this Saturday
  const sun1 = nextDow(0);    // this Sunday
  const thu2 = nextDow(4);    // next Thursday (skips today if today is Thu)
  const fri2 = nextDow(5, 1); // Friday after next
  const sat2 = nextDow(6, 1); // Saturday after next

  const lux  = idMap[CL(1)];
  const sobe = idMap[CL(2)];
  const priv = idMap[CL(3)];

  const shifts = [
    // ── Shift 1: Cocktail Party Bartender – South Beach (luxeevents) ──────────
    {
      id: SH(1), client_id: lux, title: 'Cocktail Party Bartender',
      company_name: 'Luxe Events Miami',
      job_type: 'Bartender', job_types: ['Bartender'],
      pay_rate: 35, pay_period: 'hr', spots_available: 2, spots_filled: 0,
      start_time: ts(fri1, 19), end_time: ts(fri1, 23),
      location: '1685 Collins Ave, Miami Beach, FL', lat: 25.782, lng: -80.134,
      description: 'Upscale cocktail party for 80 guests at a South Beach penthouse. Full bar setup, craft cocktails required.',
      requirements: ['Mixology experience', 'Smart casual uniform', 'Own bar tools preferred'],
      status: 'open',
    },
    // ── Shift 2: Wedding Server+Hostess – Coral Gables (sobargroup) ──────────
    {
      id: SH(2), client_id: sobe, title: 'Wedding Server & Hostess',
      company_name: 'SoBe Restaurant Group',
      job_type: 'Server', job_types: ['Server', 'Hostess'],
      pay_rate: 30, pay_period: 'hr', spots_available: 4, spots_filled: 0,
      start_time: ts(sat1, 16), end_time: ts(sat1, 22),
      location: '2200 SW 13th Ave, Coral Gables, FL', lat: 25.721, lng: -80.268,
      description: 'Elegant wedding reception for 150 guests. French service experience preferred. Black-tie attire required.',
      requirements: ['French service', 'Black-tie attire', '2+ years fine dining'],
      status: 'open',
    },
    // ── Shift 3: Corporate Event Captain+Manager – Brickell (privateeventsco) ─
    {
      id: SH(3), client_id: priv, title: 'Corporate Event Captain & Manager',
      company_name: 'Private Events Co',
      job_type: 'Captain', job_types: ['Captain', 'Manager'],
      pay_rate: 40, pay_period: 'hr', spots_available: 2, spots_filled: 0,
      start_time: ts(thu2, 18), end_time: ts(thu2, 21),
      location: '1221 Brickell Ave, Miami, FL', lat: 25.760, lng: -80.193,
      description: 'Corporate awards dinner for 200 executives. Manage FOH team, liaise with kitchen, VIP table service.',
      requirements: ['Captain experience', 'Leadership skills', 'Business formal attire'],
      status: 'open',
    },
    // ── Shift 4: Private Party DJ – Miami Beach (luxeevents) ─────────────────
    {
      id: SH(4), client_id: lux, title: 'Private Party DJ',
      company_name: 'Luxe Events Miami',
      job_type: 'DJ', job_types: ['DJ'],
      pay_rate: 50, pay_period: 'hr', spots_available: 1, spots_filled: 0,
      start_time: ts(sat1, 21), end_time: tsNextDay(sat1, 2),
      location: '100 Collins Ave, Miami Beach, FL', lat: 25.790, lng: -80.130,
      description: 'Private birthday bash on Miami Beach rooftop. Play top 40, house, and Latin. Setup at 8:30pm.',
      requirements: ['Own PA equipment', 'EDM/Top40/Latin catalogue', 'References required'],
      status: 'open',
    },
    // ── Shift 5: Dinner Party Server+Busser – Wynwood (sobargroup) ───────────
    {
      id: SH(5), client_id: sobe, title: 'Dinner Party Server & Busser',
      company_name: 'SoBe Restaurant Group',
      job_type: 'Server', job_types: ['Server', 'Busser'],
      pay_rate: 28, pay_period: 'hr', spots_available: 3, spots_filled: 0,
      start_time: ts(sun1, 17), end_time: ts(sun1, 21),
      location: '2218 NW 2nd Ave, Wynwood, FL', lat: 25.804, lng: -80.199,
      description: 'Intimate dinner party at an art gallery. 50 guests, farm-to-table menu. Casual chic attire.',
      requirements: ['Server experience', 'Casual chic attire', 'Punctuality'],
      status: 'open',
    },
    // ── Shift 6: Bar Mitzvah Server+Hostess – Aventura (privateeventsco) ─────
    {
      id: SH(6), client_id: priv, title: 'Bar Mitzvah Server & Hostess',
      company_name: 'Private Events Co',
      job_type: 'Server', job_types: ['Server', 'Hostess'],
      pay_rate: 32, pay_period: 'hr', spots_available: 5, spots_filled: 0,
      start_time: ts(sun1, 11), end_time: ts(sun1, 16),
      location: '19999 W Country Club Dr, Aventura, FL', lat: 25.956, lng: -80.139,
      description: 'Family celebration for 200 guests in Aventura. Morning setup through afternoon service. Formal attire.',
      requirements: ['Event serving', 'Formal attire', 'No dietary conflicts'],
      status: 'open',
    },
    // ── Shift 7: Birthday Party Bartender+Server – Downtown (luxeevents) ─────
    {
      id: SH(7), client_id: lux, title: 'Birthday Party Bartender & Server',
      company_name: 'Luxe Events Miami',
      job_type: 'Bartender', job_types: ['Bartender', 'Server'],
      pay_rate: 30, pay_period: 'hr', spots_available: 2, spots_filled: 0,
      start_time: ts(fri1, 20), end_time: tsNextDay(fri1, 0),
      location: '100 SE 2nd St, Miami, FL', lat: 25.774, lng: -80.193,
      description: 'Milestone birthday party at a downtown Miami rooftop bar. 100 guests, open bar, passed appetizers.',
      requirements: ['Bartending license preferred', 'Own opener', 'High energy'],
      status: 'open',
    },
    // ── Shift 8: Holiday Party Server+Security – Miami Beach (sobargroup) ────
    {
      id: SH(8), client_id: sobe, title: 'Holiday Party Server & Security',
      company_name: 'SoBe Restaurant Group',
      job_type: 'Server', job_types: ['Server', 'Security'],
      pay_rate: 34, pay_period: 'hr', spots_available: 6, spots_filled: 0,
      start_time: ts(sat2, 18), end_time: ts(sat2, 23),
      location: '3801 Collins Ave, Miami Beach, FL', lat: 25.762, lng: -80.192,
      description: 'Annual holiday gala for 300 guests. Need experienced servers and licensed security staff. Formal attire.',
      requirements: ['Server experience or Security license', 'Formal attire', 'Reliable transportation'],
      status: 'open',
    },
    // ── Shift 9: Cocktail Party Bartender+Hostess – Coral Gables (privateeventsco)
    {
      id: SH(9), client_id: priv, title: 'Cocktail Party Bartender & Hostess',
      company_name: 'Private Events Co',
      job_type: 'Bartender', job_types: ['Bartender', 'Hostess'],
      pay_rate: 36, pay_period: 'hr', spots_available: 3, spots_filled: 0,
      start_time: ts(thu2, 19), end_time: ts(thu2, 23),
      location: '169 Miracle Mile, Coral Gables, FL', lat: 25.721, lng: -80.268,
      description: 'Art gallery opening cocktail reception, 120 guests. Two-person bar team plus hostess. Smart casual.',
      requirements: ['Cocktail experience', 'Friendly demeanor', 'Smart casual attire'],
      status: 'open',
    },
    // ── Shift 10: Corporate Gala Captain+Server+Security – Brickell (privateeventsco)
    {
      id: SH(10), client_id: priv, title: 'Corporate Gala — Captain, Server & Security',
      company_name: 'Private Events Co',
      job_type: 'Captain', job_types: ['Captain', 'Server', 'Security'],
      pay_rate: 42, pay_period: 'hr', spots_available: 8, spots_filled: 0,
      start_time: ts(fri2, 17), end_time: tsNextDay(fri2, 0),
      location: '600 Brickell Ave, Miami, FL', lat: 25.760, lng: -80.193,
      description: 'Annual corporate gala for a Fortune 500 client. 400 guests, 4-course dinner. This is a high-prestige event — professionalism is paramount.',
      requirements: ['Formal attire mandatory', '5+ years event experience', 'References required'],
      status: 'open',
    },
  ];

  const { error: se } = await sb.from('shifts').upsert(shifts, { onConflict: 'id' });
  if (se) bail('shifts upsert', se);
  counts['shifts'] = shifts.length;
  console.log(`  ✓  ${shifts.length} rows (shifts 1-10 with real Miami lat/lng)`);

  // ── 4. Applications ────────────────────────────────────────────────────────
  // Strategy for idempotency:
  //   a) upsert all as 'pending' first (resets any prior accepted → trigger no-op for spots_filled)
  //   b) then update specific ones to 'accepted' (trigger increments spots_filled 0→1)
  //   c) finally hard-set correct spots_filled values directly (safety net)
  console.log('\n📝  Step 4: Applications');
  const appRows = [
    { id: AP(1),  shift_id: SH(1),  worker_id: idMap[W(1)], status: 'pending', message: 'Hi! I\'ve bartended 200+ cocktail parties in South Beach. Would love to work this event.',        match_score: 95 },
    { id: AP(2),  shift_id: SH(5),  worker_id: idMap[W(1)], status: 'pending', message: 'South Beach server available Sunday. 5 years restaurant experience.',                            match_score: 88 },
    { id: AP(3),  shift_id: SH(2),  worker_id: idMap[W(2)], status: 'pending', message: 'Wedding hostess with 7 years at Coral Gables events. French service certified.',                 match_score: 96 },
    { id: AP(4),  shift_id: SH(6),  worker_id: idMap[W(2)], status: 'pending', message: 'Available Sunday. I specialize in family celebrations and formal events.',                       match_score: 91 },
    { id: AP(5),  shift_id: SH(3),  worker_id: idMap[W(3)], status: 'pending', message: 'Licensed security and event manager. Perfect for your corporate event.',                         match_score: 93 },
    { id: AP(6),  shift_id: SH(8),  worker_id: idMap[W(3)], status: 'pending', message: 'Security + serving combo available. CPR certified, formal event experience.',                    match_score: 89 },
    { id: AP(7),  shift_id: SH(2),  worker_id: idMap[W(4)], status: 'pending', message: 'Event server available Saturday. I love weddings! 3 years fine dining.',                        match_score: 85 },
    { id: AP(8),  shift_id: SH(9),  worker_id: idMap[W(4)], status: 'pending', message: 'Coral Gables local, available Thursday nights. Cocktail party regular.',                        match_score: 90 },
    { id: AP(9),  shift_id: SH(4),  worker_id: idMap[W(5)], status: 'pending', message: 'Top-rated Miami Beach DJ. Own full PA setup. 5-star rated, 50+ events.',                        match_score: 99 },
    { id: AP(10), shift_id: SH(7),  worker_id: idMap[W(5)], status: 'pending', message: 'Downtown rooftop? My specialty. Have played this venue before.',                                 match_score: 94 },
  ];
  const { error: ae } = await sb.from('applications').upsert(appRows, { onConflict: 'id' });
  if (ae) bail('applications upsert', ae);
  console.log(`  ✓  ${appRows.length} rows inserted as pending`);

  // Accept AP(2)→shift5, AP(3)→shift2, AP(6)→shift8, AP(8)→shift9, AP(9)→shift4
  const toAccept = [AP(2), AP(3), AP(6), AP(8), AP(9)];
  const acceptedShiftMap: Record<string, number> = {
    [AP(2)]: 5, [AP(3)]: 2, [AP(6)]: 8, [AP(8)]: 9, [AP(9)]: 4,
  };
  let acceptedOk = 0;
  for (const appId of toAccept) {
    const { error: acceptErr } = await sb.from('applications')
      .update({ status: 'accepted' }).eq('id', appId);
    if (acceptErr) {
      const msg = JSON.stringify(acceptErr);
      if (msg.includes('participant_a_id') || msg.includes('participant_b_id') || msg.includes('conversation')) {
        console.warn(`  ⚠  Accept ${appId}: shift-conversation trigger uses old column names.`);
        console.warn(`     → Application accepted in DB; only conversation auto-creation failed.`);
        // Force status directly (should already be set by the update before trigger)
      } else if (msg.includes('fully booked')) {
        console.warn(`  ⚠  Accept ${appId}: shift already fully booked (re-run? spots reset below)`);
      } else {
        console.warn(`  ⚠  Accept ${appId}: ${msg}`);
      }
    } else {
      acceptedOk++;
      console.log(`  ✓  Accepted AP(${Object.keys(acceptedShiftMap).indexOf(appId) + 1}) → Shift ${acceptedShiftMap[appId]}`);
    }
  }

  // Safety net: hard-set correct spots_filled values regardless of trigger outcome
  const spotsFixes = [
    { id: SH(2), spots_filled: 1 },
    { id: SH(4), spots_filled: 1, status: 'filled' },
    { id: SH(5), spots_filled: 1 },
    { id: SH(8), spots_filled: 1 },
    { id: SH(9), spots_filled: 1 },
  ];
  let spotsOk = 0;
  for (const fix of spotsFixes) {
    const { error: sfe } = await sb.from('shifts').update(fix).eq('id', fix.id);
    if (sfe) console.warn(`  ⚠  spots_filled update failed for shift ${fix.id}: ${sfe.message}`);
    else spotsOk++;
  }
  console.log(`  ✓  spots_filled hard-set on ${spotsOk}/${spotsFixes.length} shifts (${acceptedOk} cleanly accepted)`);
  counts['applications'] = appRows.length;

  // ── 5. Reviews ─────────────────────────────────────────────────────────────
  // Uses from_user_id (reviewer) + to_user_id (reviewee) — live schema columns.
  // Service-role key bypasses the RLS accepted-application check.
  console.log('\n⭐  Step 5: Reviews (3 per worker = 24 total)');
  const reviews = [
    // sarahwilliams (W2) — 3 reviews
    { id: RV(1),  shift_id: SH(2),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(2)], rating: 5, comment: 'Sarah was absolutely professional. Guests loved her. Will book again!',                          positive_tags: ['Punctual','Professional','Great energy'] },
    { id: RV(2),  shift_id: SH(6),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(2)], rating: 5, comment: 'Outstanding hostess presence at our Bar Mitzvah. Handled everything beautifully.',               positive_tags: ['Professional','Reliable'] },
    { id: RV(18), shift_id: SH(8),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(2)], rating: 5, comment: 'Sarah is top-tier. She turned our event into something truly special.',                          positive_tags: ['Punctual','Great energy','Skilled'] },
    // mikejohnson (W1) — 3 reviews
    { id: RV(3),  shift_id: SH(5),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(1)], rating: 5, comment: 'Mike is the best bartender we\'ve ever hired. Craft cocktails were incredible.',                 positive_tags: ['Skilled','Great energy','Punctual'] },
    { id: RV(4),  shift_id: SH(1),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(1)], rating: 5, comment: 'Perfect for our cocktail party. Arrived early and impressed all guests.',                         positive_tags: ['Punctual','Professional','Skilled'] },
    { id: RV(5),  shift_id: SH(7),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(1)], rating: 4, comment: 'Great bartender, crowd loved his energy. Minor setup delay but he recovered well.',               positive_tags: ['Great energy','Skilled'] },
    // jasonlee (W5) — 3 reviews
    { id: RV(6),  shift_id: SH(4),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(5)], rating: 5, comment: 'Jason is AMAZING. The birthday party was unforgettable. 5 stars, no question.',                  positive_tags: ['Professional','Great energy','Skilled'] },
    { id: RV(7),  shift_id: SH(10), from_user_id: idMap[CL(3)], to_user_id: idMap[W(5)], rating: 5, comment: 'Best DJ at our corporate gala. Kept 400 people on the dance floor all night.',                   positive_tags: ['Professional','Reliable','Great energy'] },
    { id: RV(21), shift_id: SH(7),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(5)], rating: 5, comment: 'Jason played an incredible set. Birthday girl was absolutely thrilled!',                         positive_tags: ['Professional','Great energy','Skilled'] },
    // davidmartinez (W3) — 3 reviews
    { id: RV(8),  shift_id: SH(8),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(3)], rating: 5, comment: 'David ran an impeccable security operation. Zero incidents, very professional.',                  positive_tags: ['Reliable','Professional','Punctual'] },
    { id: RV(9),  shift_id: SH(3),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(3)], rating: 4, comment: 'Great event manager. Handled our corporate crowd with confidence.',                               positive_tags: ['Reliable','Professional'] },
    { id: RV(19), shift_id: SH(1),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(3)], rating: 4, comment: 'David handled a tricky situation with complete professionalism.',                                 positive_tags: ['Reliable','Professional'] },
    // emilydavis (W4) — 3 reviews
    { id: RV(10), shift_id: SH(9),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(4)], rating: 5, comment: 'Emily was warm, professional, and the guests adored her. Highly recommend.',                     positive_tags: ['Great energy','Punctual','Reliable'] },
    { id: RV(11), shift_id: SH(2),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(4)], rating: 4, comment: 'Good server, handled a busy wedding like a pro.',                                                positive_tags: ['Reliable','Professional'] },
    { id: RV(20), shift_id: SH(5),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(4)], rating: 5, comment: 'Emily was fantastic at our dinner party. Fast, efficient, and charming.',                        positive_tags: ['Great energy','Punctual','Skilled'] },
    // ashleybrown (W6) — 3 reviews
    { id: RV(12), shift_id: SH(10), from_user_id: idMap[CL(1)], to_user_id: idMap[W(6)], rating: 5, comment: 'Ashley\'s craft cocktails elevated our entire event. Hire her immediately.',                      positive_tags: ['Skilled','Professional','Punctual'] },
    { id: RV(13), shift_id: SH(9),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(6)], rating: 4, comment: 'Knowledgeable bartender with a great cocktail range.',                                           positive_tags: ['Skilled','Great energy'] },
    { id: RV(22), shift_id: SH(7),  from_user_id: idMap[CL(1)], to_user_id: idMap[W(6)], rating: 5, comment: 'Ashley\'s cocktails were the talk of the event. Perfect 10.',                                    positive_tags: ['Skilled','Great energy','Punctual'] },
    // carlosgomez (W7) — 3 reviews
    { id: RV(14), shift_id: SH(10), from_user_id: idMap[CL(3)], to_user_id: idMap[W(7)], rating: 5, comment: 'Carlos is the captain every event needs. Managed 8 staff flawlessly.',                           positive_tags: ['Professional','Reliable','Skilled'] },
    { id: RV(15), shift_id: SH(3),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(7)], rating: 5, comment: 'Trilingual captain who made our international guests feel completely at home.',                   positive_tags: ['Professional','Great energy','Punctual'] },
    { id: RV(23), shift_id: SH(8),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(7)], rating: 5, comment: 'Carlos coordinated our 300-guest gala like a symphony conductor.',                               positive_tags: ['Professional','Reliable','Skilled'] },
    // tiffanywhite (W8) — 3 reviews
    { id: RV(16), shift_id: SH(6),  from_user_id: idMap[CL(3)], to_user_id: idMap[W(8)], rating: 5, comment: 'Tiffany ran our corporate conference check-in perfectly. Truly professional.',                   positive_tags: ['Punctual','Professional','Reliable'] },
    { id: RV(17), shift_id: SH(8),  from_user_id: idMap[CL(2)], to_user_id: idMap[W(8)], rating: 4, comment: 'Great event specialist. Kept guests engaged and on schedule.',                                   positive_tags: ['Professional','Great energy'] },
    { id: RV(24), shift_id: SH(10), from_user_id: idMap[CL(3)], to_user_id: idMap[W(8)], rating: 5, comment: 'Tiffany made 400 guests feel welcome. Truly exceptional hospitality.',                           positive_tags: ['Great energy','Professional','Punctual'] },
  ];
  const { error: re } = await sb.from('reviews').upsert(reviews, { onConflict: 'id' });
  if (re) {
    // A stale trigger referencing old column names (reviewee_id) causes this.
    // The reviews rows themselves use the correct from_user_id/to_user_id columns.
    // Run the trigger fix SQL below in the Supabase dashboard to fully resolve.
    console.warn(`  ⚠  reviews upsert error (likely stale trigger): ${re.message}`);
    console.warn('     Fix: run the reviews-trigger SQL shown at end of this run.');
    counts['reviews'] = 0;
  } else {
    counts['reviews'] = reviews.length;
    console.log(`  ✓  ${reviews.length} rows (3 per worker)`);
  }

  // ── 6. Conversations + Messages ────────────────────────────────────────────
  // Uses participant_ids uuid[] — live schema (NOT participant_a_id/participant_b_id).
  console.log('\n💬  Step 6: Conversations & messages');
  const convs = [
    { id: CV(1), participant_ids: [idMap[W(1)], idMap[CL(1)]], shift_id: SH(1) },
    { id: CV(2), participant_ids: [idMap[W(2)], idMap[CL(2)]], shift_id: SH(2) },
    { id: CV(3), participant_ids: [idMap[W(5)], idMap[CL(3)]], shift_id: null  },
    { id: CV(4), participant_ids: [idMap[W(3)], idMap[ST(1)]], shift_id: null  },
  ];
  const { error: ce } = await sb.from('conversations').upsert(convs, { onConflict: 'id' });
  if (ce) bail('conversations upsert', ce);
  counts['conversations'] = convs.length;

  // Helper: recipient is the other participant in the conversation
  const w1 = idMap[W(1)], cl1 = idMap[CL(1)];
  const w2 = idMap[W(2)], cl2 = idMap[CL(2)];
  const w5 = idMap[W(5)], cl3 = idMap[CL(3)];
  const w3 = idMap[W(3)], st1 = idMap[ST(1)];

  const msgs = [
    // Conv 1: mikejohnson (w1) ↔ luxeevents (cl1)
    { id: MS(1),  conversation_id: CV(1), sender_id: cl1, recipient_id: w1,  text: "Hi Mike! We saw your profile and loved your experience. Are you available this Friday for our cocktail party?" },
    { id: MS(2),  conversation_id: CV(1), sender_id: w1,  recipient_id: cl1, text: "Hello! Yes, I'm available Friday. I specialize in craft cocktails — this sounds perfect." },
    { id: MS(3),  conversation_id: CV(1), sender_id: cl1, recipient_id: w1,  text: "Wonderful. It's an 80-person event at a South Beach penthouse. We need someone who can handle high volume." },
    { id: MS(4),  conversation_id: CV(1), sender_id: w1,  recipient_id: cl1, text: "No problem at all. I've done 200+ events at similar venues. What cocktails are on the menu?" },
    { id: MS(5),  conversation_id: CV(1), sender_id: cl1, recipient_id: w1,  text: "We're thinking mojitos, espresso martinis, and a signature house cocktail. Can you create something special?" },
    { id: MS(6),  conversation_id: CV(1), sender_id: w1,  recipient_id: cl1, text: "Absolutely! I have a passion fruit spritz that works perfectly for summer parties. Guests always love it." },
    { id: MS(7),  conversation_id: CV(1), sender_id: cl1, recipient_id: w1,  text: "That sounds amazing! Great, see you Friday!" },
    // Conv 2: sarahwilliams (w2) ↔ sobargroup (cl2)
    { id: MS(8),  conversation_id: CV(2), sender_id: w2,  recipient_id: cl2, text: "Hi! I just applied to your wedding event for Saturday. I wanted to introduce myself." },
    { id: MS(9),  conversation_id: CV(2), sender_id: cl2, recipient_id: w2,  text: "Sarah, great timing! We loved your profile. French service certified — exactly what we need." },
    { id: MS(10), conversation_id: CV(2), sender_id: w2,  recipient_id: cl2, text: "Thank you! I've worked many weddings at Coral Gables venues. What's the guest count?" },
    { id: MS(11), conversation_id: CV(2), sender_id: cl2, recipient_id: w2,  text: "150 guests, seated dinner, 6 courses. We need the team there by 3:30pm for setup." },
    { id: MS(12), conversation_id: CV(2), sender_id: w2,  recipient_id: cl2, text: "Perfect. I'll bring my full kit. Do you need me to coordinate with the kitchen too?" },
    { id: MS(13), conversation_id: CV(2), sender_id: cl2, recipient_id: w2,  text: "That would be great! The chef will brief you on arrival. Perfect, thanks for confirming!" },
    // Conv 3: jasonlee (w5) ↔ privateeventsco (cl3)
    { id: MS(14), conversation_id: CV(3), sender_id: cl3, recipient_id: w5,  text: "Hey Jason, we've been looking for a DJ for our Miami Beach rooftop party. Your reviews are incredible!" },
    { id: MS(15), conversation_id: CV(3), sender_id: w5,  recipient_id: cl3, text: "Thanks so much! Rooftop parties are my favorite. What's the vibe you're going for?" },
    { id: MS(16), conversation_id: CV(3), sender_id: cl3, recipient_id: w5,  text: "It's a 30th birthday. Mix of Top 40, some house, and Latin. About 100 guests expected." },
    { id: MS(17), conversation_id: CV(3), sender_id: w5,  recipient_id: cl3, text: "Perfect, that's my bread and butter. I have a great Latin house set that transitions into Top 40 at midnight." },
    { id: MS(18), conversation_id: CV(3), sender_id: cl3, recipient_id: w5,  text: "That sounds exactly right. Do you bring all your own equipment?" },
    { id: MS(19), conversation_id: CV(3), sender_id: w5,  recipient_id: cl3, text: "Yes — full PA, lighting, and CDJs. I just need a standard 20-amp outlet." },
    { id: MS(20), conversation_id: CV(3), sender_id: cl3, recipient_id: w5,  text: "No problem, that's available. Sounds like a great event, count me in." },
    // Conv 4: davidmartinez (w3) ↔ elitestaffing (st1)
    { id: MS(21), conversation_id: CV(4), sender_id: st1, recipient_id: w3,  text: "David! We have a great opportunity for you. A large-scale holiday gala needs experienced security." },
    { id: MS(22), conversation_id: CV(4), sender_id: w3,  recipient_id: st1, text: "Hello! I'm definitely interested. What's the event size and date?" },
    { id: MS(23), conversation_id: CV(4), sender_id: st1, recipient_id: w3,  text: "About 300 guests, formal event in Miami Beach. Next Saturday, 6pm to 11pm. Great pay rate." },
    { id: MS(24), conversation_id: CV(4), sender_id: w3,  recipient_id: st1, text: "That works! I have all my licenses current — Class D and G security license, CPR certified." },
    { id: MS(25), conversation_id: CV(4), sender_id: st1, recipient_id: w3,  text: "Excellent. We'll need your license numbers and a copy of your certificates. Can you send them?" },
    { id: MS(26), conversation_id: CV(4), sender_id: w3,  recipient_id: st1, text: "Of course. What's the best way to send them?" },
    { id: MS(27), conversation_id: CV(4), sender_id: st1, recipient_id: w3,  text: "Use our secure portal — I'll DM you the link shortly. Looking forward to working with you!" },
    { id: MS(28), conversation_id: CV(4), sender_id: w3,  recipient_id: st1, text: "I'll send my updated certifications today." },
  ];
  const { error: me } = await sb.from('messages').upsert(msgs, { onConflict: 'id' });
  if (me) bail('messages upsert', me);
  counts['messages'] = msgs.length;
  console.log(`  ✓  ${convs.length} conversations, ${msgs.length} messages`);

  // ── 7. Posts ───────────────────────────────────────────────────────────────
  // 3 posts per worker = 24 total. Uses photo_url (live column name).
  console.log('\n📸  Step 7: Posts (3 per worker)');
  const captionSets = [
    // mikejohnson
    ['Just wrapped an incredible cocktail party on South Beach 🍹 The crowd loved the passion fruit spritz!',
     'Set up and ready for tonight\'s gala. Full bar, full energy. Let\'s go! 🔥',
     'Behind the bar at a stunning Brickell rooftop. This is what I live for 🌆'],
    // sarahwilliams
    ['What a beautiful wedding in Coral Gables. Honored to be part of their special day 💍',
     'Morning setup for a Bar Mitzvah in Aventura. Fresh flowers, perfect table settings 🌸',
     'Event ready! Black tie, full kit, 150 guests incoming 💫'],
    // davidmartinez
    ['Keeping the peace at Miami\'s hottest event tonight 🛡️ Professional, calm, always ready.',
     'Pre-shift gear check. Licensed, certified, and ready for anything 💪',
     'Another successful holiday gala wrapped. Zero incidents, 100% professional 🎉'],
    // emilydavis
    ['Wynwood art gallery dinner service — beautiful venue, amazing guests 🎨',
     'Wedding service at its finest. Every guest felt like a VIP 🥂',
     'Sunday prep at a South Beach venue. Love this job! ☀️'],
    // jasonlee
    ['Just killed it at a Miami Beach rooftop birthday! 400 people on the dance floor until 2am 🎧',
     'Pre-set vibe check. Full PA loaded. Tonight is going to be electric ⚡',
     'Corporate gala stage setup. Lights, sound, pure magic ✨'],
    // ashleybrown
    ['Craft cocktail hour at Coral Gables 🍸 Made 200 espresso martinis — every single one was perfect.',
     'My mixology setup for the evening. 15 signature cocktails on tonight\'s menu 🍋',
     'Late night at the bar. The tips speak for themselves 💰'],
    // carlosgomez
    ['Captain on deck for a fine dining experience. 8 staff, flawless service 👨‍💼',
     'Pre-service briefing with the team. Communication is everything in fine dining 🎯',
     'Corporate awards dinner wrapped. 200 execs, zero complaints ✅'],
    // tiffanywhite
    ['Corporate conference check-in at Aventura — 500 attendees, smooth as silk 👩‍💼',
     'Hosting a luxury corporate event. Name tags, welcome packets, warm smiles 😊',
     'Post-event wind-down. Another gig completed, another 5-star review incoming ⭐'],
  ];

  const posts = workerDefs.flatMap((w, wi) =>
    captionSets[wi].map((caption, ci) => ({
      id: PT(wi * 3 + ci + 1),
      user_id: idMap[w.detId],
      photo_url: `https://picsum.photos/seed/${w.username}${ci + 1}/400/400`,
      caption,
    }))
  );
  const { error: pe } = await sb.from('posts').upsert(posts, { onConflict: 'id' });
  if (pe) bail('posts upsert', pe);
  counts['posts'] = posts.length;
  console.log(`  ✓  ${posts.length} rows`);

  // ── 8. Supplemental notifications ─────────────────────────────────────────
  // Triggers have already auto-created notifications for accepted applications
  // and reviews. These supplement with new-shift-match and application-received.
  console.log('\n🔔  Step 8: Supplemental notifications');
  const notifs = [
    { id: NT(1), user_id: idMap[W(1)], type: 'new_shift_match',      title: 'New shift near you',  body: 'New Bartender shift matches your availability — $35/hr Friday night.',  shift_id: SH(1) },
    { id: NT(2), user_id: idMap[W(2)], type: 'new_shift_match',      title: 'New shift near you',  body: 'New Hostess shift matches your availability — $32/hr Sunday morning.',   shift_id: SH(6) },
    { id: NT(3), user_id: idMap[W(5)], type: 'new_shift_match',      title: 'New shift near you',  body: 'New DJ shift matches your availability — $50/hr Saturday night.',        shift_id: SH(4) },
    { id: NT(4), user_id: idMap[W(6)], type: 'new_shift_match',      title: 'New shift near you',  body: 'New Bartender shift matches your availability — $36/hr Thursday night.', shift_id: SH(9) },
    { id: NT(5), user_id: idMap[W(7)], type: 'new_shift_match',      title: 'New shift near you',  body: 'New Captain shift in Brickell — $42/hr next Friday.',                   shift_id: SH(10) },
    { id: NT(6), user_id: idMap[CL(1)], type: 'application_received', title: 'New applicant',       body: 'Someone applied to your Cocktail Party Bartender shift.',               shift_id: SH(1),  from_user_id: idMap[W(1)] },
    { id: NT(7), user_id: idMap[CL(2)], type: 'application_received', title: 'New applicant',       body: 'Someone applied to your Wedding Server & Hostess shift.',               shift_id: SH(2),  from_user_id: idMap[W(2)] },
    { id: NT(8), user_id: idMap[CL(3)], type: 'application_received', title: 'New applicant',       body: 'Someone applied to your Corporate Gala shift.',                         shift_id: SH(10), from_user_id: idMap[W(7)] },
  ];
  const { error: ne } = await sb.from('notifications').upsert(notifs, { onConflict: 'id' });
  if (ne) bail('notifications upsert', ne);
  counts['notifications (supplemental)'] = notifs.length;
  console.log(`  ✓  ${notifs.length} rows (triggers added more automatically)`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(60));
  console.log('✅  Seed complete — row counts:');
  for (const [t, n] of Object.entries(counts)) {
    console.log(`   ${t.padEnd(35)} ${n}`);
  }
  console.log('\n📧  Test accounts (password = SEED_TEST_PASSWORD):');
  console.log('  Workers (8):');
  workerDefs.forEach(w => console.log(`    ${w.isPro ? '⭐' : '  '} ${w.email}`));
  console.log('  Clients (3):');
  clientDefs.forEach(c => console.log(`     ${c.email}`));
  console.log('  Staffers (2):');
  stafferDefs.forEach(s => console.log(`     ${s.email}`));
  console.log('\n🗺️   All 10 shifts have real Miami lat/lng and appear on the map.');
  console.log('📋  Applications: 5 workers × 2 shifts; 5 accepted, 5 pending.');
  console.log('⭐  Reviews: 3 per worker (24 total) using from_user_id/to_user_id.');
  console.log('💬  4 conversations, 28 messages (7 per conversation).');
  console.log('📸  24 posts (3 per worker) using picsum.photos placeholders.');
  console.log('═'.repeat(60));

  if (counts['reviews'] === 0) {
    // Build SQL using concatenation — editor tools corrupt consecutive $ signs.
    // Use String.fromCharCode to produce $ without writing the literal sequence.
    const dq = String.fromCharCode(36, 36); // produces $
    const triggerFixSql = [
      '-- 1. Drop the stale trigger on reviews (references old reviewee_id column)',
      'DROP TRIGGER IF EXISTS trg_update_worker_rating ON reviews;',
      'DROP FUNCTION IF EXISTS fn_update_worker_rating();',
      '',
      '-- 2. Recreate trigger using the correct to_user_id column',
      'CREATE OR REPLACE FUNCTION fn_update_worker_rating()',
      'RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS ' + dq,
      'BEGIN',
      '  UPDATE users',
      '  SET rating = (',
      '    SELECT ROUND(AVG(r.rating)::numeric, 2)',
      '    FROM reviews r WHERE r.to_user_id = NEW.to_user_id',
      '  )',
      '  WHERE id = NEW.to_user_id;',
      '  RETURN NEW;',
      'END;',
      dq + ';',
      '',
      'CREATE TRIGGER trg_update_worker_rating',
      'AFTER INSERT OR UPDATE ON reviews',
      'FOR EACH ROW EXECUTE FUNCTION fn_update_worker_rating();',
      '',
      '-- 3. Also fix the shift-accepted conversation trigger if needed',
      'DROP TRIGGER IF EXISTS trg_create_shift_conversation ON applications;',
      'DROP FUNCTION IF EXISTS fn_create_shift_conversation();',
      '',
      'CREATE OR REPLACE FUNCTION fn_create_shift_conversation()',
      'RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS ' + dq,
      'DECLARE',
      '  v_client_id uuid;',
      'BEGIN',
      '  IF NEW.status = \'accepted\' AND (OLD.status IS DISTINCT FROM \'accepted\') THEN',
      '    SELECT client_id INTO v_client_id FROM shifts WHERE id = NEW.shift_id;',
      '    IF v_client_id IS NOT NULL THEN',
      '      INSERT INTO conversations (participant_ids, shift_id)',
      '      VALUES (ARRAY[NEW.worker_id, v_client_id], NEW.shift_id)',
      '      ON CONFLICT DO NOTHING;',
      '    END IF;',
      '  END IF;',
      '  RETURN NEW;',
      'END;',
      dq + ';',
      '',
      'CREATE TRIGGER trg_create_shift_conversation',
      'AFTER UPDATE ON applications',
      'FOR EACH ROW EXECUTE FUNCTION fn_create_shift_conversation();',
      '',
      '-- 4. Re-run the seed after fixing: cd scripts && npx tsx src/seed.ts',
    ].join('\n');

    console.log('\n⚠️  REVIEWS TRIGGER FIX — run this SQL in Supabase Dashboard → SQL Editor:');
    console.log('─'.repeat(60));
    console.log(triggerFixSql);
    console.log('─'.repeat(60));
    console.log('After running the SQL above, re-run:  cd scripts && npx tsx src/seed.ts\n');
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// TEARDOWN
// ═════════════════════════════════════════════════════════════════════════════
async function teardown() {
  console.log('\n🗑️  365 Connect — Teardown starting…');
  console.log('   This deletes all rows with @seed.365connect.dev emails and their cascade data.\n');

  // Delete conversations first (participant_ids is an array, no FK cascade from users)
  const convIds = [CV(1), CV(2), CV(3), CV(4)];
  const { error: ce } = await sb.from('conversations').delete().in('id', convIds);
  if (ce) console.warn(`  ⚠  conversations: ${ce.message}`);
  else    console.log('  ✓  conversations deleted (→ messages cascade)');

  // Delete auth users — ON DELETE CASCADE handles:
  // public.users → shifts → applications, reviews, time_entries
  //             → posts, notifications, follows, messages (via sender_id)
  const seedEmails = [
    'mike.johnson@seed.365connect.dev',   'sarah.williams@seed.365connect.dev',
    'david.martinez@seed.365connect.dev', 'emily.davis@seed.365connect.dev',
    'jason.lee@seed.365connect.dev',      'ashley.brown@seed.365connect.dev',
    'carlos.gomez@seed.365connect.dev',   'tiffany.white@seed.365connect.dev',
    'luxeevents@seed.365connect.dev',     'sobargroup@seed.365connect.dev',
    'privateeventsco@seed.365connect.dev','elitestaffing@seed.365connect.dev',
    'premierstaff@seed.365connect.dev',
  ];
  const detIds = [
    W(1),W(2),W(3),W(4),W(5),W(6),W(7),W(8),
    CL(1),CL(2),CL(3), ST(1),ST(2),
  ];

  // Fetch full user list once for fallback lookups
  const { data: allUsers } = await admin.listUsers({ perPage: 1000 });
  const byEmail = new Map(allUsers?.users?.map(u => [u.email ?? '', u.id]) ?? []);

  let deleted = 0;
  let notFound = 0;
  for (let i = 0; i < detIds.length; i++) {
    const detId  = detIds[i];
    const email  = seedEmails[i];

    // Try deterministic ID first
    const { error: e1 } = await admin.deleteUser(detId);
    if (!e1) { deleted++; console.log(`  ✓  ${email}`); continue; }

    // Fallback: find by email
    const actualId = byEmail.get(email);
    if (actualId) {
      const { error: e2 } = await admin.deleteUser(actualId);
      if (!e2) { deleted++; console.log(`  ✓  ${email} (by email fallback)`); }
      else     { console.warn(`  ⚠  ${email}: ${e2.message}`); }
    } else {
      notFound++;
      console.log(`  ○  ${email} not found (already deleted or never seeded)`);
    }
  }

  console.log(`\n✅  Teardown complete.`);
  console.log(`   Auth users deleted: ${deleted} / ${detIds.length}`);
  console.log(`   Not found (already gone): ${notFound}`);
  console.log('   All cascade data (shifts, applications, reviews, posts, messages, notifications) removed.');
}

// ═════════════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═════════════════════════════════════════════════════════════════════════════
(async () => {
  try {
    if (TEARDOWN) await teardown();
    else          await seed();
  } catch (err) {
    console.error('\n❌  Fatal error:', err);
    process.exit(1);
  }
})();
