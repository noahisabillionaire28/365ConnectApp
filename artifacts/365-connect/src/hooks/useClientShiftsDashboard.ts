import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatTime } from '@/lib/supabase';

type RawShift = {
  id: string;
  client_id: string;
  title: string;
  event_type: string | null;
  job_type: string | null;
  company_name: string | null;
  status: string;
  start_time: string;
  end_time: string;
  /** IANA zone of the venue (display times in it). */
  timezone?: string | null;
  pay_rate: number | null;
  pay_period: string | null;
  spots_available: number;
  spots_filled: number;
  location: string | null;
  created_at: string;
  /** Set when this shift is one position of a multi-position event. */
  event_id?: string | null;
  /** Applicants still waiting on a decision (computed by the API). */
  pending_count?: number;
  /** Swaps both workers agreed on that only the poster can finish. */
  swap_count?: number;
};

export type ClientShift = RawShift & {
  applicationCount: number;
  /** Alias for applicationCount */
  applicantCount: number;
  /** Swaps waiting on the poster's approval */
  swapCount: number;
  /** camelCase aliases */
  eventType: string | null;
  jobType: string | null;
  companyName: string | null;
  startTime: string;
  startTimeISO: string;
  payRate: number | null;
  payPeriod: string | null;
};

/** @deprecated use ClientShift */
export type DashboardShift = ClientShift;

function toClientShift(s: RawShift): ClientShift {
  const appCount = s.pending_count ?? 0;
  return {
    ...s,
    applicationCount: appCount,
    applicantCount:   appCount,
    swapCount:        s.swap_count ?? 0,
    eventType:        s.event_type  ?? null,
    jobType:          s.job_type    ?? null,
    companyName:      s.company_name ?? null,
    startTime:        formatTime(s.start_time, s.timezone),
    startTimeISO:     s.start_time,
    payRate:          s.pay_rate    ?? null,
    payPeriod:        s.pay_period  ?? null,
  };
}

export const CLIENT_SHIFTS_KEY = 'client-shifts';

/** The poster's own shifts with pending-applicant counts — cached, one request. */
export function useClientShiftsDashboard() {
  const { user } = useAuth();
  const q = useQuery<ClientShift[], Error>({
    queryKey: [CLIENT_SHIFTS_KEY, user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<RawShift[]>('/shifts/my');
      return rows.map(toClientShift);
    },
  });
  return {
    shifts: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? q.error.message : null,
    refetch: q.refetch,
  };
}
