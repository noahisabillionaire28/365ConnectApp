/**
 * TanStack Query hooks for admin data — all backed by the admin API server.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@/lib/adminApi';

export function useAdminStats() {
  return useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.getStats, staleTime: 30_000 });
}

export function useAdminUsers() {
  return useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.getUsers, staleTime: 30_000 });
}

export function useAdminShifts() {
  return useQuery({ queryKey: ['admin', 'shifts'], queryFn: adminApi.getShifts, staleTime: 30_000 });
}

export function useAdminPayments() {
  return useQuery({ queryKey: ['admin', 'payments'], queryFn: adminApi.getPayments, staleTime: 30_000 });
}

export function useAdminDisputes() {
  return useQuery({ queryKey: ['admin', 'disputes'], queryFn: adminApi.getDisputes, staleTime: 30_000 });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof adminApi.updateUser>[1] }) =>
      adminApi.updateUser(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'users'] }); },
  });
}

export function useCancelShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => adminApi.cancelShift(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'shifts'] }); },
  });
}

export function useUpdateDispute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status: string; note?: string }) =>
      adminApi.updateDispute(id, status, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'disputes'] });
      qc.invalidateQueries({ queryKey: ['admin', 'stats'] });
    },
  });
}
