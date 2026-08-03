import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type RawShift = {
  id: string;
  client_id: string;
  title: string;
  job_type: string | null;
  company_name: string | null;
  status: string;
  start_time: string;
  end_time: string;
  pay_rate: number | null;
  pay_period: string | null;
  spots_available: number;
  spots_filled: number;
  location: string | null;
  created_at: string;
};

export type ClientShift = RawShift & {
  applicationCount: number;
  /** Alias for applicationCount */
  applicantCount: number;
  /** camelCase aliases */
  jobType: string | null;
  companyName: string | null;
  startTime: string;
  startTimeISO: string;
  payRate: number | null;
  payPeriod: string | null;
};

/** @deprecated use ClientShift */
export type DashboardShift = ClientShift;

function toClientShift(s: RawShift, appCount: number): ClientShift {
  return {
    ...s,
    applicationCount: appCount,
    applicantCount:   appCount,
    jobType:          s.job_type    ?? null,
    companyName:      s.company_name ?? null,
    startTime:        s.start_time,
    startTimeISO:     s.start_time,
    payRate:          s.pay_rate    ?? null,
    payPeriod:        s.pay_period  ?? null,
  };
}

export function useClientShiftsDashboard() {
  const { user } = useAuth();
  const [shifts, setShifts]     = useState<ClientShift[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setShifts([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const myShifts = await apiClient(user.id).get<RawShift[]>('/shifts/my');
      const appCountMap = new Map<string, number>();
      await Promise.all(myShifts.map(async (s) => {
        try {
          const applicants = await apiClient(user.id).get<unknown[]>(`/applications?shift_id=${s.id}`);
          appCountMap.set(s.id, applicants.length);
        } catch {
          appCountMap.set(s.id, 0);
        }
      }));
      setShifts(myShifts.map((s) => toClientShift(s, appCountMap.get(s.id) ?? 0)));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  return { shifts, isLoading, error, refetch: load };
}
