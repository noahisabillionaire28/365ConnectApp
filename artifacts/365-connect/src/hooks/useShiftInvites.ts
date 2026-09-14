import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type ShiftInvite = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined';
  worker_username: string | null;
  worker_photo: string | null;
  created_at: string;
};

/**
 * The invites (shift_requests) the caller sent for one shift, newest first.
 * Used by the owner's Applicants screen to show who was requested and whether
 * they've accepted, so a broadcast ("Request All Workers") is trackable.
 */
export function useShiftInvites(shiftId: string | undefined) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['shift-invites', shiftId, user?.id],
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    queryFn: async () => {
      const rows = await apiClient(user!.id).get<ShiftInvite[]>('/shift-requests');
      return (rows ?? []).filter((r) => r.shift_id === shiftId);
    },
  });
  return { invites: q.data ?? [], isLoading: q.isLoading, refetch: q.refetch };
}
