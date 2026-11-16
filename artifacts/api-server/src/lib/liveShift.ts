/**
 * Live shift board pings. When anything on a shift's timesheets changes
 * (clock in/out, a break, the worker's sign-off, an approval) the server
 * broadcasts a bare "refresh" on the public Realtime channel
 * `shift-live:<shiftId>`. The poster's open board hears it and refetches
 * the roster through the API, which checks ownership — the ping itself
 * carries no data, so listening to it reveals nothing.
 *
 * Best-effort with a short timeout: a ping that fails only means the board
 * catches up on its next poll.
 */
const url = process.env['VITE_SUPABASE_URL'] ?? '';
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';

export const liveTopic = (shiftId: string) => `shift-live:${shiftId}`;

export async function pingShift(shiftId: string | null | undefined): Promise<void> {
  if (!shiftId || !url || !key) return;
  try {
    await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ topic: liveTopic(shiftId), event: 'refresh', payload: { at: Date.now() } }] }),
      signal: AbortSignal.timeout(1500),
    });
  } catch { /* the board's poll covers a missed ping */ }
}
