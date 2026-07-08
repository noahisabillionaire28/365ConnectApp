import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SHIFTS_QUERY_KEY } from './useShifts';

export type PostShiftInput = {
  client_id:       string;
  title:           string;
  job_type:        string;
  job_types:       string[];
  description?:    string;
  requirements?:   string[];
  location?:       string;
  lat?:            number;
  lng?:            number;
  unit_info?:      string;
  pay_rate?:       number;
  start_time:      string;  // ISO datetime string
  end_time:        string;  // ISO datetime string
  spots_available: number;
};

/**
 * Mutation that inserts a new shift row.
 * Invalidates the shifts cache on success so feeds update in real time.
 * Returns the newly-inserted ShiftRow on success.
 */
export function usePostShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PostShiftInput) => {
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          client_id:       input.client_id,
          title:           input.title,
          job_type:        input.job_type,
          job_types:       input.job_types,
          description:     input.description   ?? null,
          requirements:    input.requirements  ?? [],
          location:        input.location      ?? null,
          lat:             input.lat           ?? null,
          lng:             input.lng           ?? null,
          unit_info:       input.unit_info     ?? null,
          pay_rate:        input.pay_rate      ?? null,
          pay_period:      'hr',
          start_time:      input.start_time,
          end_time:        input.end_time,
          spots_available: input.spots_available,
          spots_filled:    0,
          status:          'open',
          ai_match_pct:    85,
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
