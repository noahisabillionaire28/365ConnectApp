/**
 * File uploads via Supabase Storage.
 *
 * Uploads go to the public `uploads` bucket using the signed-in user's Supabase
 * session, and we store/serve the returned public URL. (The previous
 * implementation used Replit object storage, which does not exist on the
 * production host.)
 */
import { supabase } from '@/lib/supabase';
import { apiClient } from '@/lib/api';
import { compressImage } from '@/lib/imageCompression';

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * The backend (service-role) mints a pre-authorised signed upload URL and
 * ensures the bucket exists; the browser then uploads directly to Supabase.
 * This needs no client-side storage RLS policy. Throws on failure.
 */
export async function uploadFile(
  file: File | Blob,
  name: string,
  userId?: string | null,
): Promise<{ objectPath: string; url: string }> {
  // Shrink large photos before upload (best-effort; non-images pass through).
  const payload = await compressImage(file);

  const sig = await apiClient(userId).post<{
    bucket: string; path: string; token: string; publicUrl: string;
  }>('/storage/sign-upload', { name });

  const { error } = await supabase.storage
    .from(sig.bucket)
    .uploadToSignedUrl(sig.path, sig.token, payload);
  if (error) throw new Error(`Upload failed: ${error.message}`);

  return { objectPath: sig.path, url: sig.publicUrl };
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
