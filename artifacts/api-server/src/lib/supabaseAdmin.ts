/**
 * Supabase admin client — uses the service-role key so it bypasses all RLS.
 * Import ONLY from server-side code; never expose this client to the browser.
 *
 * Environment variables (set in Replit Secrets):
 *   VITE_SUPABASE_URL        — project URL  (shared with frontend VITE_ var)
 *   SUPABASE_SERVICE_ROLE_KEY — service-role secret (server-only)
 */
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env['VITE_SUPABASE_URL'] ?? '';
const serviceKey  = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

if (!supabaseUrl || !serviceKey) {
  console.warn(
    '[Admin DB] Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — ' +
    'admin API endpoints will return errors.',
  );
}

export const adminDb = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
