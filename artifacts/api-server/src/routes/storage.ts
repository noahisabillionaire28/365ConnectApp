import { limitUser } from '../lib/rateLimit.js';
import { Router, type IRouter, type Request, type Response } from 'express';
import { adminDb } from '../lib/supabaseAdmin.js';

const router: IRouter = Router();

// ── Supabase Storage: signed-upload flow ─────────────────────────────────────
// The service-role client mints a pre-authorised upload URL (bypassing storage
// RLS) and ensures the bucket exists, so the browser can upload directly to
// Supabase Storage without depending on any client-side storage policy.
const UPLOAD_BUCKET = 'uploads';
let bucketReady = false;

/** What the app uploads: photos, short videos, voice notes and PDFs. 25 MB cap. */
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif',
  'video/mp4', 'video/quicktime',
  'audio/*',
  'application/pdf',
];

function mimeAllowed(type: string): boolean {
  const t = type.toLowerCase().split(';')[0].trim();
  return ALLOWED_MIME_TYPES.some((a) => (a.endsWith('/*') ? t.startsWith(a.slice(0, -1)) : t === a));
}

/**
 * Create the bucket with type/size limits, or bring an existing bucket up to
 * the same limits (they used to be unset). Runs once per warm instance.
 */
async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  const options = { public: true, fileSizeLimit: MAX_UPLOAD_BYTES, allowedMimeTypes: ALLOWED_MIME_TYPES };
  try {
    const { error } = await adminDb.storage.createBucket(UPLOAD_BUCKET, options);
    if (error) {
      // Already exists: enforce the limits on it.
      const { error: updErr } = await adminDb.storage.updateBucket(UPLOAD_BUCKET, options);
      if (updErr) console.warn(`[storage] could not update bucket limits: ${updErr.message}`);
    }
  } catch (e) {
    console.warn(`[storage] bucket setup threw: ${String(e)}`);
  }
  bucketReady = true;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/**
 * POST /storage/sign-upload { name, contentType, size } — returns a
 * pre-authorised Supabase Storage upload URL for the signed-in user. The
 * client then uploads the file directly. The bucket enforces the same type
 * and size limits, so a client that skips this route gains nothing.
 */
router.post('/storage/sign-upload', limitUser(60, 3600000), async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? safeName(body.name) : 'file';
  const contentType = typeof body.contentType === 'string' ? body.contentType : '';
  const size = typeof body.size === 'number' && Number.isFinite(body.size) ? body.size : null;
  if (!contentType || !mimeAllowed(contentType)) {
    res.status(415).json({ error: 'That file type is not supported. Use a photo, video (MP4/MOV), audio clip or PDF.' });
    return;
  }
  if (size != null && size > MAX_UPLOAD_BYTES) {
    res.status(413).json({ error: 'That file is too large. The limit is 25 MB.' });
    return;
  }
  const path = `${req.userId}/${Date.now()}-${name}`;
  try {
    await ensureBucket();
    const { data, error } = await adminDb.storage
      .from(UPLOAD_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !data) {
      res.status(500).json({ error: error?.message ?? 'Could not create upload URL' });
      return;
    }
    const { data: pub } = adminDb.storage.from(UPLOAD_BUCKET).getPublicUrl(path);
    res.json({ bucket: UPLOAD_BUCKET, path, token: data.token, publicUrl: pub.publicUrl });
  } catch (e) {
    res.status(500).json({ error: `Upload URL failed: ${String(e)}` });
  }
});

export default router;
