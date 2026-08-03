/**
 * Object Storage helpers — Task #23.
 *
 * Two-step presigned-URL flow:
 *   1. POST /api/storage/uploads/request-url → { uploadURL, objectPath }
 *   2. PUT <uploadURL>  (direct to GCS — no backend traffic)
 *
 * Returns objectPath (e.g. "/objects/uploads/<uuid>").
 * Serve with:  GET /api/storage/objects/uploads/<uuid>
 *   → full URL: /api/storage + objectPath
 */

const SERVE_BASE = '/api/storage';

/**
 * Request a presigned upload URL from our API, then PUT the file straight to GCS.
 * Returns the objectPath (store in DB) and the serving URL.
 * Throws on any failure.
 */
export async function uploadFile(
  file: File | Blob,
  name: string,
  userId?: string | null,
): Promise<{ objectPath: string; url: string }> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) headers['x-user-id'] = userId;

  // Step 1: request presigned URL
  const metaRes = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers,
    credentials: 'include',    // send Clerk session cookie
    body: JSON.stringify({
      name,
      size: file.size,
      contentType: file instanceof File ? file.type : (file as Blob).type,
    }),
  });
  if (!metaRes.ok) {
    const err = await metaRes.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? `Storage: failed to get upload URL (${metaRes.status})`);
  }
  const { uploadURL, objectPath } = await metaRes.json() as { uploadURL: string; objectPath: string };

  // Step 2: PUT file directly to GCS — no custom headers here, GCS validates the presigned URL
  const uploadRes = await fetch(uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file instanceof File ? file.type : 'application/octet-stream' },
    body: file,
  });
  if (!uploadRes.ok) throw new Error(`Storage: GCS upload failed (${uploadRes.status})`);

  return { objectPath, url: `${SERVE_BASE}${objectPath}` };
}

/** Upload a user avatar. Returns the serving URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadFile(file, `avatar-${userId}.${ext}`, userId);
  return url;
}

/** Upload a post/shift cover photo. Returns the serving URL. */
export async function uploadPostPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadFile(file, `post-${userId}-${Date.now()}.${ext}`, userId);
  return url;
}

/** Upload a chat image. Returns the serving URL (stored in message.image_url). */
export async function uploadChatImage(
  conversationId: string, file: File, userId?: string | null,
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const { url } = await uploadFile(file, `chat-${conversationId}-img-${Date.now()}.${ext}`, userId);
    return url;
  } catch (e) {
    console.error('[storage] uploadChatImage failed:', e);
    return null;
  }
}

/** Upload a chat video. Returns the serving URL. */
export async function uploadChatVideo(
  conversationId: string, file: File, userId?: string | null,
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'mp4';
    const { url } = await uploadFile(file, `chat-${conversationId}-vid-${Date.now()}.${ext}`, userId);
    return url;
  } catch (e) {
    console.error('[storage] uploadChatVideo failed:', e);
    return null;
  }
}

/** Upload a chat voice message. Returns the serving URL. */
export async function uploadChatVoice(
  conversationId: string, blob: Blob, userId?: string | null,
): Promise<string | null> {
  try {
    const { url } = await uploadFile(blob, `chat-${conversationId}-voice-${Date.now()}.webm`, userId);
    return url;
  } catch (e) {
    console.error('[storage] uploadChatVoice failed:', e);
    return null;
  }
}

/**
 * Chat media served via our Object Storage is already a full serving URL
 * (stored as `/api/storage/objects/...`), so no signed URL lookup is needed.
 * This shim returns the path as-is, keeping ChatScreen compatible.
 */
export async function getSignedChatMediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  // If it's already a full serving URL (our new format), return it directly
  if (path.startsWith('/api/storage') || path.startsWith('http')) return path;
  // Legacy Supabase paths — can't serve them, return null gracefully
  return null;
}
