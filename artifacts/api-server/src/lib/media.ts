/**
 * Validation shared by the routes that store user media (posts, stories).
 *
 * A photo URL must point at this project's public `uploads` bucket, which is
 * the only place the app ever uploads to. Anything else (another host, a
 * data: URI, javascript:) is refused so a post can never embed a tracking
 * pixel or a remote image the bucket's type/size limits never saw.
 */
import { HttpError } from './httpError.js';

const SUPABASE_URL = (process.env['VITE_SUPABASE_URL'] ?? '').replace(/\/+$/, '');
const UPLOAD_BUCKET = 'uploads';

/** Instagram's caption limit; long enough for anyone, short enough to render. */
export const MAX_CAPTION = 2200;

/** True when `url` is a public object in this project's uploads bucket. */
export function isOurUploadUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !SUPABASE_URL) return false;
  const prefix = `${SUPABASE_URL}/storage/v1/object/public/${UPLOAD_BUCKET}/`;
  if (!url.startsWith(prefix)) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && u.search === '' && u.hash === '';
  } catch {
    return false;
  }
}

/** The photo URL to store, or an HttpError explaining why not. */
export function requireUploadUrl(url: unknown, what = 'photo'): string {
  if (url == null || url === '') throw new HttpError(400, `A ${what} is required.`);
  if (!isOurUploadUrl(url)) throw new HttpError(400, `That ${what} isn't one of your uploads. Pick it from your device and try again.`);
  return url;
}

/** Trimmed caption (or null), capped at MAX_CAPTION characters. */
export function cleanCaption(caption: unknown): string | null {
  if (caption == null) return null;
  if (typeof caption !== 'string') throw new HttpError(400, 'Caption must be text.');
  const trimmed = caption.trim();
  if (!trimmed) return null;
  if ([...trimmed].length > MAX_CAPTION) throw new HttpError(400, `Captions can be at most ${MAX_CAPTION} characters.`);
  return trimmed;
}
