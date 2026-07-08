import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type MyApplicationStatus = 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn';

export type MyApplication = {
  applicationId: string;
  shiftId: string;
  status: MyApplicationStatus;
  matchScore: number | null;
  appliedAt: string;
  shiftTitle: string;
  companyName: string | null;
  coverImage: string | null;
  jobType: string;
  payRate: number | null;
  payPeriod: string;
  startTime: string | null;
};

/**
 * All applications the current worker has submitted, newest first, joined
 * with the parent shift so the "My Applications" list on Profile can render
 * title/company/pay without a second round-trip per row. Realtime keeps the
 * status column (pending → accepted/declined) in sync when a client decides.
 */
export function useMyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setApplications([]); setIsLoading(false); return; }
    setIsLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('applications')
      .select('id, shift_id, status, match_score, created_at, shifts (title, company_name, cover_image, job_type, pay_rate, pay_period, start_time)')
      .eq('worker_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[useMyApplications] fetch failed:', fetchError.message);
      setError(fetchError.message);
      setIsLoading(false);
      return;
    }

    setApplications(
      (data ?? []).map((row: any) => ({
        applicationId: row.id as string,
        shiftId:       row.shift_id as string,
        status:        row.status as MyApplicationStatus,
        matchScore:    row.match_score as number | null,
        appliedAt:     row.created_at as string,
        shiftTitle:    row.shifts?.title ?? 'Shift',
        companyName:   row.shifts?.company_name ?? null,
        coverImage:    row.shifts?.cover_image ?? null,
        jobType:       row.shifts?.job_type ?? '',
        payRate:       row.shifts?.pay_rate ?? null,
        payPeriod:     row.shifts?.pay_period ?? 'hr',
        startTime:     row.shifts?.start_time ?? null,
      })),
    );
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Realtime: pick up status changes (accept/decline) without a manual refresh
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`my-applications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'applications', filter: `worker_id=eq.${user.id}` },
        () => { void load(); },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, load]);

  return { applications, isLoading, error, refetch: load };
}
