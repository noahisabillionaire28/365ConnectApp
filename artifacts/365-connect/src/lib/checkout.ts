/**
 * Stripe Checkout helpers. The backend creates a hosted Checkout session and we
 * redirect the browser to it; on return the app confirms the session so the
 * payment is recorded.
 *
 * The amount is never sent: the server charges the approved pay on the
 * worker's timesheet, and refuses to pay the same worker twice for a shift.
 */
import { apiClient } from '@/lib/api';

export async function startShiftPayment(
  userId: string | null | undefined,
  args: { shift_id: string; worker_id: string },
): Promise<void> {
  const { url } = await apiClient(userId).post<{ url?: string; amount?: number }>('/payments/checkout', args);
  if (!url) throw new Error('Could not start checkout.');
  window.location.href = url;
}

export async function confirmShiftPayment(
  userId: string | null | undefined,
  sessionId: string,
): Promise<void> {
  await apiClient(userId).post('/payments/confirm', { session_id: sessionId });
}
