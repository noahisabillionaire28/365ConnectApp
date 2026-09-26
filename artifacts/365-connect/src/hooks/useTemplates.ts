import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import type { TemplatePayload } from '@/store/postShiftStore';
import { utcToZonedParts, DEFAULT_SHIFT_TZ } from '@/lib/timezone';

export const TEMPLATES_KEY = ['templates'] as const;
export const MAX_TEMPLATES = 20;

type RawTemplate = {
  id: string;
  client_id: string;
  name: string;
  payload: TemplatePayload;
  use_count: number | null;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftTemplate = {
  id: string;
  name: string;
  payload: TemplatePayload;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function toTemplate(r: RawTemplate): ShiftTemplate {
  return {
    id: r.id,
    name: r.name,
    payload: r.payload ?? {},
    useCount: r.use_count ?? 0,
    lastUsedAt: r.last_used_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** "Bartender, Server · $35/hr · 3 spots" */
export function templateSummary(p: TemplatePayload): string {
  const bits: string[] = [];
  const types = p.job_types?.length ? p.job_types : (p.job_type ? [p.job_type] : []);
  if (types.length) bits.push(types.join(', '));
  if (p.pay_rate && p.pay_rate > 0) bits.push(`$${p.pay_rate}${p.pay_period && p.pay_period !== 'hr' ? ` per ${p.pay_period}` : '/hr'}`);
  if (p.spots_available) bits.push(`${p.spots_available} spot${p.spots_available === 1 ? '' : 's'}`);
  return bits.join(' · ') || 'No details yet';
}

/** "Used 3 times · last Oct 3" / "Never used" */
export function templateUsage(t: ShiftTemplate): string {
  if (!t.useCount || !t.lastUsedAt) return 'Never used';
  const when = new Date(t.lastUsedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Used ${t.useCount} time${t.useCount === 1 ? '' : 's'} · last ${when}`;
}

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

/** The template a stored shift row (as GET /shifts/:id returns it) would make. */
export function shiftRowToTemplatePayload(raw: Record<string, unknown>): TemplatePayload {
  const tz = (raw.timezone as string | null) || DEFAULT_SHIFT_TZ;
  const start = utcToZonedParts(String(raw.start_time ?? ''), tz);
  const end = utcToZonedParts(String(raw.end_time ?? ''), tz);
  const jobTypes = strList(raw.job_types);
  const payPeriod = raw.pay_period === 'day' || raw.pay_period === 'event' ? raw.pay_period : 'hr';
  const num = (v: unknown) => (v == null || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
  return {
    title:            (raw.title as string) ?? '',
    event_type:       (raw.event_type as string | null) ?? null,
    job_type:         (raw.job_type as string) ?? jobTypes[0] ?? '',
    job_types:        jobTypes,
    location:         (raw.location as string | null) ?? null,
    lat:              num(raw.lat),
    lng:              num(raw.lng),
    unit_info:        (raw.unit_info as string | null) ?? null,
    pay_rate:         num(raw.pay_rate) ?? 0,
    pay_period:       payPeriod,
    spots_available:  num(raw.spots_available) ?? 1,
    dress_code:       (raw.dress_code as string | null) ?? null,
    dress_code_items: strList(raw.dress_code_items),
    requirements:     strList(raw.requirements),
    description:      (raw.description as string | null) ?? null,
    point_of_contact: (raw.point_of_contact as string | null) ?? null,
    contact_phone:    (raw.contact_phone as string | null) ?? null,
    parking_notes:    (raw.parking_notes as string | null) ?? null,
    special_instructions: (raw.special_instructions as string | null) ?? null,
    visibility:       raw.visibility === 'roster' ? 'roster' : 'public',
    instant_claim:    !!raw.instant_claim,
    start_time:       start.time || '18:00',
    end_time:         end.time || '23:00',
    timezone:         tz,
  };
}

/** The poster's shift templates, plus save / rename / overwrite / delete / use. */
export function useTemplates(enabled = true) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = [...TEMPLATES_KEY, user?.id];
  const invalidate = () => { void qc.invalidateQueries({ queryKey: TEMPLATES_KEY }); };

  const q = useQuery<ShiftTemplate[], Error>({
    queryKey: key,
    enabled: !!user?.id && enabled,
    staleTime: 60_000,
    queryFn: async () => (await apiClient(user!.id).get<RawTemplate[]>('/templates')).map(toTemplate),
  });

  const save = useMutation<ShiftTemplate, Error, { name: string; payload: TemplatePayload }>({
    mutationFn: async (input) => toTemplate(await apiClient(user!.id).post<RawTemplate>('/templates', input)),
    onSuccess: invalidate,
  });

  const update = useMutation<ShiftTemplate, Error, { id: string; name?: string; payload?: TemplatePayload }>({
    mutationFn: async ({ id, ...body }) => toTemplate(await apiClient(user!.id).patch<RawTemplate>(`/templates/${id}`, body)),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, Error, string>({
    mutationFn: async (id) => { await apiClient(user!.id).delete(`/templates/${id}`); },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      qc.setQueryData<ShiftTemplate[]>(key, (prev) => (prev ?? []).filter((t) => t.id !== id));
    },
    onSettled: invalidate,
  });

  const use = useMutation<ShiftTemplate, Error, string>({
    mutationFn: async (id) => toTemplate(await apiClient(user!.id).post<RawTemplate>(`/templates/${id}/use`, {})),
    onSuccess: invalidate,
  });

  return {
    templates: q.data ?? [],
    isLoading: q.isLoading,
    save: save.mutateAsync,
    saving: save.isPending,
    update: update.mutateAsync,
    updating: update.isPending,
    remove: remove.mutateAsync,
    use: use.mutateAsync,
    using: use.isPending,
    canSaveMore: (q.data?.length ?? 0) < MAX_TEMPLATES,
  };
}
