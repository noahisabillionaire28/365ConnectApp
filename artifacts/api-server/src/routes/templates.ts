/**
 * Shift templates — a poster saves a shift's details (everything but the
 * dates) under a name and starts the next post from it. Owner-scoped: every
 * route only ever touches the caller's own templates.
 */
import { Router } from 'express';
import { z } from 'zod';
import { adminDb } from '../lib/supabaseAdmin.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendError } from '../lib/httpError.js';

const router = Router();

export const MAX_TEMPLATES = 20;

const SELECT = 'id, client_id, name, payload, use_count, last_used_at, created_at, updated_at';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const hhmm = z.string().regex(/^\d{2}:\d{2}$/, 'Times must be HH:MM');
const ianaZone = z.string().min(1).max(64).refine((tz) => {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}, 'Invalid time zone');

/** The draft fields a template keeps. Dates are deliberately not part of it. */
const templatePayload = z.object({
  title:            z.string().trim().max(80).optional(),
  event_type:       z.string().max(60).nullable().optional(),
  job_type:         z.string().trim().max(60).optional(),
  job_types:        z.array(z.string().trim().min(1).max(60)).max(10).optional(),
  location:         z.string().max(300).nullable().optional(),
  lat:              z.coerce.number().min(-90).max(90).nullable().optional(),
  lng:              z.coerce.number().min(-180).max(180).nullable().optional(),
  unit_info:        z.string().max(120).nullable().optional(),
  pay_rate:         z.coerce.number().min(0).max(10_000).optional(),
  pay_period:       z.enum(['hr', 'day', 'event']).optional(),
  spots_available:  z.coerce.number().int().min(1).max(200).optional(),
  dress_code:       z.string().max(300).nullable().optional(),
  dress_code_items: z.array(z.string().max(100)).max(30).optional(),
  requirements:     z.array(z.string().max(200)).max(30).optional(),
  description:      z.string().max(4000).nullable().optional(),
  point_of_contact: z.string().max(120).nullable().optional(),
  contact_phone:    z.string().max(40).nullable().optional(),
  parking_notes:    z.string().max(1000).nullable().optional(),
  special_instructions: z.string().max(4000).nullable().optional(),
  visibility:       z.enum(['public', 'roster']).optional(),
  instant_claim:    z.coerce.boolean().optional(),
  start_time:       hhmm.optional(),
  end_time:         hhmm.optional(),
  timezone:         ianaZone.optional(),
});

const templateName = z.string().trim().min(1, 'Give the template a name').max(60, 'Template name is too long');

const createBody = z.object({ name: templateName, payload: templatePayload });
const patchBody = z.object({ name: templateName.optional(), payload: templatePayload.optional() })
  .refine((b) => b.name !== undefined || b.payload !== undefined, { message: 'Nothing to update' });

function firstIssue(err: z.ZodError): string {
  return err.issues[0]?.message ?? 'Invalid template';
}

/** GET /api/templates — the caller's templates, most recently updated first. */
router.get('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const { data, error } = await adminDb
    .from('shift_templates').select(SELECT)
    .eq('client_id', req.userId)
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? []);
});

/** POST /api/templates — save a template (max 20 per poster). */
router.post('/', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  try {
    const parsed = createBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

    const { count, error: cErr } = await adminDb
      .from('shift_templates').select('*', { count: 'exact', head: true }).eq('client_id', req.userId);
    if (cErr) return res.status(500).json({ error: cErr.message });
    if ((count ?? 0) >= MAX_TEMPLATES) {
      return res.status(409).json({ error: `You can keep up to ${MAX_TEMPLATES} templates. Delete one first.` });
    }

    const { data, error } = await adminDb
      .from('shift_templates')
      .insert({ client_id: req.userId, name: parsed.data.name, payload: parsed.data.payload })
      .select(SELECT).single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  } catch (e) {
    return sendError(res, e);
  }
});

/** PATCH /api/templates/:id — rename and/or overwrite the payload. */
router.patch('/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
  const parsed = patchBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: firstIssue(parsed.error) });

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.payload !== undefined) updates.payload = parsed.data.payload;

  const { data, error } = await adminDb
    .from('shift_templates').update(updates)
    .eq('id', id).eq('client_id', req.userId)
    .select(SELECT).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  if (!data) return res.status(404).json({ error: 'Not found' });
  return res.json(data);
});

/** DELETE /api/templates/:id */
router.delete('/:id', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
  const { error } = await adminDb
    .from('shift_templates').delete()
    .eq('id', id).eq('client_id', req.userId);
  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

/** POST /api/templates/:id/use — count a use and return the payload to load. */
router.post('/:id/use', requireAuth, requireRole('client', 'staffer'), async (req, res) => {
  const id = String(req.params.id);
  if (!UUID_RE.test(id)) return res.status(404).json({ error: 'Not found' });
  const { data: current, error: curErr } = await adminDb
    .from('shift_templates').select(SELECT)
    .eq('id', id).eq('client_id', req.userId).maybeSingle();
  if (curErr) return res.status(500).json({ error: curErr.message });
  if (!current) return res.status(404).json({ error: 'Not found' });

  const { data, error } = await adminDb
    .from('shift_templates')
    .update({ use_count: (current.use_count ?? 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', id).eq('client_id', req.userId)
    .select(SELECT).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  return res.json(data ?? current);
});

export default router;
