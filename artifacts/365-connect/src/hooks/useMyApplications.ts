import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

type RawApplication = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn';
  match_score: number | null;
  applied_at: string;
  created_at: string;
  // Joined shift fields
  title?: string | null;
  job_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  pay_rate?: number | null;
  pay_period?: string | null;
  company_name?: string | null;
  client_id?: string | null;
  cover_image?: string | null;
};

export type MyApplication = RawApplication & {
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn';
  /** camelCase aliases */
  shiftId: string;
  applicationId: string;
  shiftTitle: string | null;
  companyName: string | null;
  startTime: string | null;
  endTime: string | null;
  payRate: number | null;
  payPeriod: string | null;
  jobType: string | null;
  coverImage: string | null;
};

/** @deprecated use MyApplication */
export type ApplicationWithShift = MyApplication;

function toMyApplication(r: RawApplication): MyApplication {
  return {
    ...r,
    shiftId:       r.shift_id,
    applicationId: r.id,
    shiftTitle:    r.title    ?? null,
    companyName:   r.company_name ?? null,
    startTime:     r.start_time  ?? null,
    endTime:       r.end_time    ?? null,
    payRate:       r.pay_rate    ?? null,
    payPeriod:     r.pay_period  ?? null,
    jobType:       r.job_type    ?? null,
    coverImage:    r.cover_image ?? null,
  };
}

export function useMyApplications() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<MyApplication[]>([]);
  const [isLoading, setLoading]         = useState(true);
  const [error, setError]               = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) { setApplications([]); setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const rows = await apiClient(user.id).get<RawApplication[]>('/applications');
      setApplications(rows.map(toMyApplication));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  return { applications, isLoading, error, refetch: load };
}
