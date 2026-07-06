import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SHIFTS_QUERY_KEY } from './useShifts';

export type PostShiftInput = {
  client_id: string;
  title: string;
  job_type: string;
  job_types: string[];
  company_name?: string;
  description?: string;
  location?: string;
  lat?: number;
  lng?: number;
  unit_info?: string;
  parking_notes?: string;
  hourly_rate?: number;
  start_time: string;   // ISO datetime string
  end_time: string;     // ISO datetime string
  spots?: number;
  dress_code?: string;
  dress_code_items?: string[];
  point_of_contact?: string;
  contact_phone?: string;
  special_instructions?: string;
  repeat_type?: string;
  cover_image?: string;
};

/**
 * Mutation that inserts a new shift row.
 * Invalidates the shifts cache on success so the feed updates in real time.
 */
export function usePostShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PostShiftInput) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          ...input,
          pay_period:   'hr',
          spots:        input.spots ?? 1,
          spots_filled: 0,
          status:       'open',
          ai_match_pct: 85,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
    },
  });
}
