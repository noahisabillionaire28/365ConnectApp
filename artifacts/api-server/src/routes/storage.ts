import { Readable } from 'stream';
import { Router, type IRouter, type Request, type Response } from 'express';
import {
  ObjectNotFoundError,
  ObjectStorageService,
} from '../lib/objectStorage.js';
import { adminDb } from '../lib/supabaseAdmin.js';

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

// ── Supabase Storage: signed-upload flow ─────────────────────────────────────
// The service-role client mints a pre-authorised upload URL (bypassing storage
// RLS) and ensures the bucket exists, so the browser can upload directly to
// Supabase Storage without depending on any client-side storage policy.
const UPLOAD_BUCKET = 'uploads';
let bucketReady = false;

async function ensureBucket(): Promise<void> {
  if (bucketReady) return;
  try {
    await adminDb.storage.createBucket(UPLOAD_BUCKET, {
      public: true,
      fileSizeLimit: '25MB',
    });
  } catch { /* already exists — fine */ }
  bucketReady = true;
}

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80) || 'file';
}

/**
 * POST /storage/sign-upload — returns a pre-authorised Supabase Storage upload
 * URL for the signed-in user. The client then uploads the file directly.
 */
router.post('/storage/sign-upload', async (req: Request, res: Response) => {
  if (!req.userId) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const body = req.body as Record<string, unknown>;
  const name = typeof body.name === 'string' ? safeName(body.name) : 'file';
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

/**
 * POST /storage/uploads/request-url
 *
 * Request a presigned URL for file upload.
 * The client sends JSON metadata (name, size, contentType) — NOT the file.
 * Then uploads the file directly to the returned presigned URL.
 * Requires auth so public callers cannot mint write-capable URLs.
 */
router.post(
  '/storage/uploads/request-url',
  async (req: Request, res: Response) => {
    if (!req.userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const body = req.body as Record<string, unknown>;
    if (!body || typeof body.name !== 'string') {
      res.status(400).json({ error: 'Missing required field: name' });
      return;
    }

    const name        = body.name;
    const size        = typeof body.size === 'number' ? body.size : undefined;
    const contentType = typeof body.contentType === 'string' ? body.contentType : undefined;

    try {
      const uploadURL  = await objectStorageService.getObjectEntityUploadURL();
      const objectPath = objectStorageService.normalizeObjectEntityPath(uploadURL);

      res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
    } catch (error) {
      req.log?.error({ err: error }, 'Error generating upload URL');
      res.status(500).json({ error: 'Failed to generate upload URL' });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets from PUBLIC_OBJECT_SEARCH_PATHS.
 * Unconditionally public — no authentication or ACL checks.
 */
router.get(
  '/storage/public-objects/*filePath',
  async (req: Request, res: Response) => {
    try {
      const raw      = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join('/') : raw;
      const file     = await objectStorageService.searchPublicObject(filePath);
      if (!file) {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      const response = await objectStorageService.downloadObject(file);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      if (response.body) {
        const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
        nodeStream.pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log?.error({ err: error }, 'Error serving public object');
      res.status(500).json({ error: 'Failed to serve public object' });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve uploaded object entities from PRIVATE_OBJECT_DIR.
 */
router.get('/storage/objects/*path', async (req: Request, res: Response) => {
  try {
    const raw          = req.params.path;
    const wildcardPath = Array.isArray(raw) ? raw.join('/') : raw;
    const objectPath   = `/objects/${wildcardPath}`;
    const objectFile   = await objectStorageService.getObjectEntityFile(objectPath);

    const response = await objectStorageService.downloadObject(objectFile);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    if (response.body) {
      const nodeStream = Readable.fromWeb(response.body as ReadableStream<Uint8Array>);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      req.log?.warn({ err: error }, 'Object not found');
      res.status(404).json({ error: 'Object not found' });
      return;
    }
    req.log?.error({ err: error }, 'Error serving object');
    res.status(500).json({ error: 'Failed to serve object' });
  }
});

export default router;
