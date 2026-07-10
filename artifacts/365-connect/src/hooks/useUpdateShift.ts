import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { SHIFTS_QUERY_KEY } from './useShifts';

export type UpdateShiftInput = {
  id:              string;
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
  start_time:      string;   // ISO datetime
  end_time:        string;   // ISO datetime
  spots_available: number;
};

/** Mutation that updates an existing shift row (client edit flow). */
export function useUpdateShift() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateShiftInput) => {
      const { error } = await supabase
        .from('shifts')
        .update({
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
          start_time:      input.start_time,
          end_time:        input.end_time,
          spots_available: input.spots_available,
        })
        .eq('id', input.id);
      if (error) throw error;
      return input.id;
    },
    onSuccess: (_id, input) => {
      queryClient.invalidateQueries({ queryKey: SHIFTS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ['my-posted-shifts'] });
      queryClient.invalidateQueries({ queryKey: ['client-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['shift', input.id] });
    },
  });
}
