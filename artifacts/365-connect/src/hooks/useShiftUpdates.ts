import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

export type ShiftUpdate = {
  id: string;
  shift_id: string;
  author_id: string;
  kind: 'update' | 'announcement';
  body: string;
  created_at: string;
  author_username: string | null;
  author_photo_url: string | null;
};

/** Updates & announcements posted to a shift (owner + booked workers can read). */
export function useShiftUpdates(shiftId: string | undefined) {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ['shift-updates', shiftId],
    enabled: !!shiftId && !!user?.id,
    staleTime: 15_000,
    queryFn: () => apiClient(user!.id).get<ShiftUpdate[]>(`/shift-updates/${shiftId}`),
  });
  return { updates: q.data ?? [], isLoading: q.isLoading, isError: q.isError, refetch: q.refetch };
}

/** Post an update or announcement (owner/staffer). */
export function usePostShiftUpdate(shiftId: string | undefined) {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; kind: 'update' | 'announcement' }) =>
      apiClient(user!.id).post('/shift-updates', { shift_id: shiftId, ...input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shift-updates', shiftId] }),
  });
}
