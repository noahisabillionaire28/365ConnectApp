/**
 * File uploads via Supabase Storage.
 *
 * Uploads go to the public `uploads` bucket using the signed-in user's Supabase
 * session, and we store/serve the returned public URL. (The previous
 * implementation used Replit object storage, which does not exist on the
 * production host.)
 */
import { supabase } from '@/lib/supabase';

const BUCKET = 'uploads';

/** Sanitise a filename into a storage-safe segment. */
function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 * Throws on failure.
 */
export async function uploadFile(
  file: File | Blob,
  name: string,
  userId?: string | null,
): Promise<{ objectPath: string; url: string }> {
  const folder = userId || 'anon';
  const path = `${folder}/${Date.now()}-${safeName(name)}`;
  const contentType =
    file instanceof File ? file.type : (file as Blob).type || 'application/octet-stream';

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { objectPath: path, url: data.publicUrl };
}

/** Upload a user avatar. Returns the serving URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadFile(file, `avatar.${ext}`, userId);
  return url;
}

/** Upload a post/shift cover photo. Returns the serving URL. */
export async function uploadPostPhoto(userId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  const { url } = await uploadFile(file, `post.${ext}`, userId);
  return url;
}

/** Upload a chat image. Returns the serving URL (stored in message.image_url). */
export async function uploadChatImage(
  conversationId: string, file: File, userId?: string | null,
): Promise<string | null> {
  try {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const { url } = await uploadFile(file, `chat-${conversationId}-img.${ext}`, userId);
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
    const { url } = await uploadFile(file, `chat-${conversationId}-vid.${ext}`, userId);
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
    const { url } = await uploadFile(blob, `chat-${conversationId}-voice.webm`, userId);
    return url;
  } catch (e) {
    console.error('[storage] uploadChatVoice failed:', e);
    return null;
  }
}

/**
 * Chat media is stored as a full public URL, so no signed-URL lookup is needed.
 * Returns the URL as-is; legacy non-URL paths return null gracefully.
 */
export async function getSignedChatMediaUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  if (path.startsWith('http') || path.startsWith('/api/storage')) return path;
  return null;
}
