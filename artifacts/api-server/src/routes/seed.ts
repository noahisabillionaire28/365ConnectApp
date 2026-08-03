/**
 * Seed — creates test users + demo shifts in Replit Postgres.
 * Only runs in development. Safe to re-run (upserts / ON CONFLICT).
 */
import { pool } from '@workspace/db';

const WORKER_ID  = 'seed-worker-001';
const CLIENT_ID  = 'seed-client-001';
const STAFFER_ID = 'seed-staffer-001';
const ADMIN_ID   = 'seed-admin-001';

function addHours(base: Date, h: number): string {
  return new Date(base.getTime() + h * 3600000).toISOString();
}
function dayPlusHour(days: number, hour: number): Date {
  const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hour, 0, 0, 0); return d;
}

export async function seedTestUser(): Promise<{ ok: boolean; message: string }> {
  if (process.env['NODE_ENV'] === 'production') return { ok: false, message: 'Skipped in production' };

  try {
    // Upsert seed users
    await pool.query(`
      INSERT INTO users (id, email, role, username, photo_url, bio, job_types, certifications,
                         rating, primary_job_type, secondary_job_types, lat, lng, is_pro, status)
      VALUES
        ($1,'worker@365connect.dev','worker','alex_worker',
         'https://api.dicebear.com/7.x/avataaars/svg?seed=worker','Experienced bartender and server',
         ARRAY['Bartender','Server'],'{}',4.8,'Bartender',ARRAY['Server'],25.7617,-80.1918,false,'active'),
        ($2,'client@365connect.dev','client','miami_venue',
         'https://api.dicebear.com/7.x/avataaars/svg?seed=client','Miami venue manager',
         '{}','{}',4.5,NULL,'{}',25.7751,-80.1339,true,'active'),
        ($3,'staffer@365connect.dev','staffer','top_staffing',
         'https://api.dicebear.com/7.x/avataaars/svg?seed=staffer','Premier staffing agency',
         '{}','{}',4.7,NULL,'{}',25.7889,-80.2110,true,'active'),
        ($4,'admin@365connect.dev','admin','platform_admin',
         'https://api.dicebear.com/7.x/avataaars/svg?seed=admin','Platform administrator',
         '{}','{}',5.0,NULL,'{}',25.7617,-80.1918,false,'active')
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email, username = EXCLUDED.username
    `, [WORKER_ID, CLIENT_ID, STAFFER_ID, ADMIN_ID]);

    const now = new Date();
    const shifts = [
      {
        id: '00000000-0000-0000-0000-000000000001',
        client_id: CLIENT_ID, title: 'Bartender — The Rooftop Bar',
        job_type: 'Bartender', job_types: ['Bartender'],
        company_name: 'The Rooftop Bar',
        description: 'High-volume craft cocktail bar. Looking for experienced bartenders.',
        location: 'Miami Beach, FL', lat: 25.7825, lng: -80.1298,
        pay_rate: 35, pay_period: 'hr',
        start_time: dayPlusHour(0, 21).toISOString(),
        end_time: addHours(dayPlusHour(0, 21), 6),
        spots_available: 4, spots_filled: 2, status: 'open', ai_match_pct: 97,
        requirements: ['2+ yrs bartending','TIPS certified'],
        dress_code_items: ['All Black','Black Non-Slip Shoes'],
        point_of_contact: 'Samantha Cruz',
      },
      {
        id: '00000000-0000-0000-0000-000000000002',
        client_id: CLIENT_ID, title: 'Banquet Server — Grand Ballroom',
        job_type: 'Server', job_types: ['Server'],
        company_name: 'JW Marriott Miami',
        description: 'Upscale banquet service for corporate gala. 300+ guests.',
        location: 'Downtown Miami, FL', lat: 25.7751, lng: -80.1977,
        pay_rate: 28, pay_period: 'hr',
        start_time: dayPlusHour(1, 18).toISOString(),
        end_time: addHours(dayPlusHour(1, 18), 5),
        spots_available: 8, spots_filled: 3, status: 'open', ai_match_pct: 91,
        requirements: ['Banquet experience','Formal service skills'],
        dress_code_items: ['All Black','White Dress Shirt'],
        point_of_contact: 'Marcus Johnson',
      },
      {
        id: '00000000-0000-0000-0000-000000000003',
        client_id: CLIENT_ID, title: 'Brand Ambassador — Wynwood Pop-Up',
        job_type: 'Brand Ambassador', job_types: ['Brand Ambassador'],
        company_name: 'Absolut Vodka',
        description: 'Represent the brand at a Wynwood art district event.',
        location: 'Wynwood, Miami, FL', lat: 25.8000, lng: -80.1990,
        pay_rate: 22, pay_period: 'hr',
        start_time: dayPlusHour(2, 14).toISOString(),
        end_time: addHours(dayPlusHour(2, 14), 6),
        spots_available: 6, spots_filled: 0, status: 'open', ai_match_pct: 78,
        requirements: ['Outgoing personality','Brand experience preferred'],
        dress_code_items: ['Brand Shirt Provided','Jeans','Sneakers'],
        point_of_contact: 'Ashley Kim',
      },
      {
        id: '00000000-0000-0000-0000-000000000004',
        client_id: CLIENT_ID, title: 'VIP Cocktail Server — SkyBar',
        job_type: 'Server', job_types: ['Server','Bartender'],
        company_name: 'SkyBar at the Shore Club',
        description: 'VIP pool deck cocktail service. High-energy environment.',
        location: 'South Beach, Miami Beach, FL', lat: 25.7867, lng: -80.1300,
        pay_rate: 32, pay_period: 'hr',
        start_time: dayPlusHour(3, 20).toISOString(),
        end_time: addHours(dayPlusHour(3, 20), 7),
        spots_available: 5, spots_filled: 1, status: 'open', ai_match_pct: 88,
        requirements: ['Cocktail experience','High-volume comfort'],
        dress_code_items: ['All Black','Black Apron Provided'],
        point_of_contact: 'Carlos Reyes',
      },
    ];

    for (const s of shifts) {
      await pool.query(`
        INSERT INTO shifts (
          id, client_id, title, job_type, job_types, company_name, description,
          location, lat, lng, pay_rate, pay_period, start_time, end_time,
          spots_available, spots_filled, status, ai_match_pct,
          requirements, dress_code_items, point_of_contact
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
        ON CONFLICT (id) DO NOTHING
      `, [
        s.id, s.client_id, s.title, s.job_type, s.job_types, s.company_name,
        s.description, s.location, s.lat, s.lng, s.pay_rate, s.pay_period,
        s.start_time, s.end_time, s.spots_available, s.spots_filled, s.status,
        s.ai_match_pct, s.requirements, s.dress_code_items, s.point_of_contact,
      ]);
    }

    return { ok: true, message: `Seeded ${shifts.length} shifts and 4 users` };
  } catch (err) {
    return { ok: false, message: String(err) };
  }
}
