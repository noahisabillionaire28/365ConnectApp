import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { ArrivalStatus } from './useArrivalStatus';

type RawApplication = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn' | 'standby';
  match_score: number | null;
  applied_at: string;
  created_at: string;
  /** Day-of status the worker reported (null until they tap a pill). */
  arrival_status?: ArrivalStatus | null;
  arrival_status_at?: string | null;
  /** Why a withdrawn booking was released: 'swap' when it was handed to another worker. */
  callout_reason?: string | null;
  // Joined shift fields
  title?: string | null;
  /** The shift's own lifecycle state (a cancelled shift is not "upcoming"). */
  shift_status?: 'open' | 'filled' | 'cancelled' | 'completed' | null;
  job_type?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  timezone?: string | null;
  location?: string | null;
  pay_rate?: number | null;
  pay_period?: string | null;
  company_name?: string | null;
  client_id?: string | null;
  cover_image?: string | null;
  point_of_contact?: string | null;
  contact_phone?: string | null;
  lat?: number | null;
  lng?: number | null;
  /** The poster's profile photo / logo. */
  client_logo?: string | null;
};

export type MyApplication = RawApplication & {
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn' | 'standby';
  /** camelCase aliases */
  shiftId: string;
  applicationId: string;
  shiftTitle: string | null;
  shiftStatus: 'open' | 'filled' | 'cancelled' | 'completed' | null;
  companyName: string | null;
  startTime: string | null;
  endTime: string | null;
  payRate: number | null;
  payPeriod: string | null;
  jobType: string | null;
  coverImage: string | null;
  arrivalStatus: ArrivalStatus | null;
  arrivalStatusAt: string | null;
  calloutReason: string | null;
  timezone: string | null;
  location: string | null;
  pointOfContact: string | null;
  contactPhone: string | null;
  lat: number | null;
  lng: number | null;
  clientLogo: string | null;
};

/** @deprecated use MyApplication */
export type ApplicationWithShift = MyApplication;

function toMyApplication(r: RawApplication): MyApplication {
  return {
    ...r,
    shiftId:       r.shift_id,
    applicationId: r.id,
    shiftTitle:    r.title    ?? null,
    shiftStatus:   r.shift_status ?? null,
    companyName:   r.company_name ?? null,
    startTime:     r.start_time  ?? null,
    endTime:       r.end_time    ?? null,
    payRate:       r.pay_rate    ?? null,
    payPeriod:     r.pay_period  ?? null,
    jobType:       r.job_type    ?? null,
    coverImage:    r.cover_image ?? null,
    arrivalStatus:   r.arrival_status ?? null,
    arrivalStatusAt: r.arrival_status_at ?? null,
    calloutReason:   r.callout_reason ?? null,
    timezone:        r.timezone ?? null,
    location:        r.location ?? null,
    pointOfContact:  r.point_of_contact ?? null,
    contactPhone:    r.contact_phone ?? null,
    lat:             r.lat ?? null,
    lng:             r.lng ?? null,
    clientLogo:      r.client_logo ?? null,
  };
}

export const MY_APPLICATIONS_KEY = 'my-applications';

/** The worker's applications with their shifts — cached so Schedule opens instantly. */
export function useMyApplications() {
  const { user } = useAuth();
  const q = useQuery<MyApplication[], Error>({
    queryKey: [MY_APPLICATIONS_KEY, user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<RawApplication[]>('/applications');
      return rows.map(toMyApplication);
    },
  });
  return {
    applications: q.data ?? [],
    isLoading: q.isLoading,
    error: q.error ? q.error.message : null,
    refetch: q.refetch,
  };
}

/** A worker's applications sorted into what the schedule shows. */
export function groupApplications(apps: MyApplication[]) {
  const now = Date.now();
  // A booked shift stays "upcoming" until it ENDS (so it doesn't jump to
  // Completed the moment it starts, while you're still working it).
  const isOver = (a: MyApplication) => {
    const ref = a.endTime ?? a.startTime;
    return !!ref && Date.parse(ref) <= now;
  };
  // Soonest first for anything ahead; most recent first for what's done.
  const soonest = (a: MyApplication, b: MyApplication) => Date.parse(a.startTime ?? '') - Date.parse(b.startTime ?? '');
  const latest  = (a: MyApplication, b: MyApplication) => -soonest(a, b);
  // A cancelled shift is never "upcoming", whatever the application says: it
  // gets its own section so the worker sees what happened and nothing more.
  const isCancelled = (a: MyApplication) => a.shiftStatus === 'cancelled';
  const live = apps.filter((a) => !isCancelled(a));
  return {
    upcoming:  live.filter((a) => a.status === 'accepted' && !isOver(a)).sort(soonest),
    applied:   live.filter((a) => a.status === 'pending' && !isOver(a)).sort(soonest),
    standby:   live.filter((a) => a.status === 'standby' && !isOver(a)).sort(soonest),
    completed: live.filter((a) => a.status === 'accepted' && isOver(a)).sort(latest),
    // Applications that were never answered before the shift ended.
    expired:   live.filter((a) => (a.status === 'pending' || a.status === 'standby') && isOver(a)),
    // A spot handed to another worker through an approved swap is not a
    // drop; it gets its own label so the worker is not told they bailed.
    swapped:   live.filter((a) => a.status === 'withdrawn' && a.calloutReason === 'swap').sort(latest),
    dropped:   live.filter((a) => a.status === 'withdrawn' && a.calloutReason !== 'swap'),
    notSelected: live.filter((a) => a.status === 'declined' || a.status === 'rejected'),
    // Shifts the organizer cancelled while this worker was booked, applied or waitlisted.
    cancelled: apps.filter((a) => isCancelled(a) && ['accepted', 'pending', 'standby'].includes(a.status)).sort(latest),
  };
}
