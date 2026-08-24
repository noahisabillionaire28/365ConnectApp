/**
 * Stripe Checkout helpers. The backend creates a hosted Checkout session and we
 * redirect the browser to it; on return the app confirms the session so the
 * payment is recorded.
 */
import { apiClient } from '@/lib/api';

export async function startShiftPayment(
  userId: string | null | undefined,
  args: { shift_id: string; worker_id: string; amount: number },
): Promise<void> {
  const { url } = await apiClient(userId).post<{ url?: string }>('/payments/checkout', args);
  if (!url) throw new Error('Could not start checkout.');
  window.location.href = url;
}

export async function confirmShiftPayment(
  userId: string | null | undefined,
  sessionId: string,
): Promise<void> {
  await apiClient(userId).post('/payments/confirm', { session_id: sessionId });
}
