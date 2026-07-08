import { createClient } from '@supabase/supabase-js';
import type { MockShift } from '@/data/mockFeed';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[365 Connect] Supabase is not configured. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Replit Secrets.'
  );
}

export const supabase = createClient(
  supabaseUrl     ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);

// ─── Typed row shapes (match DB schema exactly) ───────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  role: 'worker' | 'client' | 'admin' | 'staffer';
  username: string | null;
  photo_url: string | null;
  bio: string | null;
  job_types: string[];
  certifications: string[];
  rating: number;
  created_at: string;
  // Phase 4 additions (feeds / discovery / map)
  primary_job_type: string | null;
  secondary_job_types: string[];
  availability: Record<string, boolean> | null;
  lat: number | null;
  lng: number | null;
  is_pro: boolean;
};

/** Matches the actual `shifts` table after Phase 2 additions */
export type ShiftRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  location: string | null;
  job_type: string;
  job_types: string[];
  pay_rate: number | null;
  pay_period: string;
  start_time: string;       // ISO timestamptz from DB
  end_time: string;         // ISO timestamptz from DB
  date: string | null;      // optional display-date override; usually null — derive from start_time
  spots_available: number;  // total slots posted (despite the name, this is the total, not the remainder — remainder = spots_available - spots_filled)
  spots_filled: number;
  status: 'open' | 'filled' | 'cancelled' | 'completed';
  created_at: string;
  // Phase 2 extended columns
  lat: number | null;
  lng: number | null;
  cover_image: string | null;
  company_name: string | null;
  requirements: string[];
  dress_code: string | null;
  dress_code_items: string[];
  point_of_contact: string | null;
  contact_phone: string | null;
  ai_match_pct: number;
  unit_info: string | null;
  parking_notes: string | null;
  special_instructions: string | null;
  repeat_type: string;
};

export type ApplicationRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'rejected' | 'withdrawn';
  message: string | null;
  match_score: number | null;
  created_at: string;
};

export type NotificationType =
  | 'application_received'
  | 'application_accepted'
  | 'application_declined'
  | 'new_shift_match'
  | 'payment_received'
  | 'new_review'
  | 'new_follower'
  | 'direct_shift_request'
  | 'shift_cancelled'
  | 'shift_starting_soon';

/** Matches the live `notifications` table exactly (read_at, not a boolean `read`). */
export type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType | string;
  title: string;
  body: string | null;
  shift_id: string | null;
  from_user_id: string | null;
  amount: number | null;
  read_at: string | null;
  created_at: string;
};

export type TimeEntryRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  clock_in: string;
  clock_out: string | null;
  break_minutes: number;
  total_hours: number | null;
  total_pay: number | null;
  fee: number | null;
  created_at: string;
};

export type PaymentRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
};

export type ConversationRow = {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  shift_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  video_url: string | null;
  voice_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  shift_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  positive_tags: string[];
  negative_tags: string[];
  created_at: string;
};

export type FollowRow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

/** A client/staffer's direct invite to a specific worker for one of their open shifts. */
export type ShiftRequestRow = {
  id: string;
  shift_id: string;
  client_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
};

// ─── Date / time helpers ──────────────────────────────────────────────────────

/** "9:00 PM" format from an ISO timestamptz string */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** "Tonight" / "Tomorrow" / "Mon Jul 8" from an ISO timestamptz string */
export function friendlyDate(iso: string): string {
  const d         = new Date(iso);
  const today     = new Date();
  const tomorrow  = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  if (d.toDateString() === today.toDateString())    return 'Tonight';
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// Fallback cover images by job type
const COVER_FALLBACKS: Record<string, string> = {
  'Bartender':        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=800&auto=format&fit=crop&q=80',
  'Cocktail Server':  'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=800&auto=format&fit=crop&q=80',
  'Server':           'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
  'Security':         'https://images.unsplash.com/photo-1566417713940-fe7c737a9ef2?w=800&auto=format&fit=crop&q=80',
  'Brand Ambassador': 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=80',
  'Event Setup':      'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=800&auto=format&fit=crop&q=80',
  'Catering Lead':    'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800&auto=format&fit=crop&q=80',
  'Host / Hostess':   'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&auto=format&fit=crop&q=80',
  'VIP Server':       'https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=800&auto=format&fit=crop&q=80',
  'DJ':               'https://images.unsplash.com/photo-1571266028243-e30e3b89e3a0?w=800&auto=format&fit=crop&q=80',
  default:            'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&auto=format&fit=crop&q=80',
};

// Miami Beach center — used for distance approximation when a real location is unavailable
export const MIAMI_BEACH = { lat: 25.7913, lng: -80.145 };

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R    = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Adapter: ShiftRow (DB) → MockShift (UI) ─────────────────────────────────

export function shiftRowToMockShift(
  row: ShiftRow,
  refCoords: { lat: number; lng: number } = MIAMI_BEACH,
): MockShift {
  const primaryType    = row.job_type || row.job_types?.[0] || 'Event Staff';
  const lat            = row.lat  ?? MIAMI_BEACH.lat;
  const lng            = row.lng  ?? MIAMI_BEACH.lng;
  const spotsAvailable = Math.max(0, (row.spots_available ?? 1) - (row.spots_filled ?? 0));

  return {
    id:             row.id,
    jobType:        primaryType,
    jobTypes:       row.job_types?.length ? row.job_types : [primaryType],
    companyName:    row.company_name    ?? 'Private Client',
    coverImage:     row.cover_image     ?? COVER_FALLBACKS[primaryType] ?? COVER_FALLBACKS.default,
    payRate:        Number(row.pay_rate ?? 0),
    payPeriod:      (row.pay_period as 'hr' | 'day' | 'event') ?? 'hr',
    date:           row.date ?? friendlyDate(row.start_time),
    startTime:      formatTime(row.start_time),
    endTime:        formatTime(row.end_time),
    startTimeISO:   row.start_time,
    distanceMiles:  Math.round(haversineMiles(refCoords.lat, refCoords.lng, lat, lng) * 10) / 10,
    spotsAvailable,
    spotsTotal:     row.spots_available ?? 1,
    location:       row.location        ?? 'Miami, FL',
    aiMatchPct:     row.ai_match_pct    ?? 85,
    description:    row.description     ?? '',
    requirements:   row.requirements    ?? [],
    dressCode:      row.dress_code      ?? '',
    dressCodeItems: row.dress_code_items ?? [],
    pointOfContact: row.point_of_contact ?? '',
    contactPhone:   row.contact_phone   ?? '',
    lat,
    lng,
    clientId:       row.client_id,
    status:         row.status,
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) {
    console.error('[Supabase Storage] Avatar upload failed:', error.message);
    return null;
  }
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function uploadPostPhoto(userId: string, file: File): Promise<string | null> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    console.error('[Supabase Storage] Post photo upload failed:', error.message);
    return null;
  }
  return supabase.storage.from('post-photos').getPublicUrl(path).data.publicUrl;
}

/**
 * Chat attachments live in a PRIVATE bucket (unlike public avatars/post-photos),
 * so these return the storage PATH, not a public URL — resolve to a viewable
 * URL at render time with `getSignedChatMediaUrl`.
 *
 * Paths are namespaced by CONVERSATION, not by uploader: `${conversationId}/kind/file`.
 * That lets the storage RLS policy check "is this requester a participant of
 * THIS conversation" directly, instead of "does the requester share *some*
 * conversation with the uploader" — the latter would let a user who shares
 * one thread with someone read that person's media from unrelated threads too.
 */
async function uploadChatMedia(
  conversationId: string, file: Blob, kind: 'images' | 'videos' | 'voice', ext: string, contentType: string,
): Promise<string | null> {
  const path = `${conversationId}/${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage
    .from('chat-media')
    .upload(path, file, { upsert: false, contentType });
  if (error) {
    console.error(`[Supabase Storage] Chat ${kind} upload failed:`, error.message);
    return null;
  }
  return path;
}

export async function uploadChatImage(conversationId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
  return uploadChatMedia(conversationId, file, 'images', ext, file.type);
}

export async function uploadChatVideo(conversationId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'mp4';
  return uploadChatMedia(conversationId, file, 'videos', ext, file.type);
}

export async function uploadChatVoice(conversationId: string, blob: Blob): Promise<string | null> {
  return uploadChatMedia(conversationId, blob, 'voice', 'webm', blob.type || 'audio/webm');
}

/** Resolves a chat-media storage path to a short-lived viewable URL (1 hour). */
export async function getSignedChatMediaUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('chat-media').createSignedUrl(path, 3600);
  if (error) {
    console.error('[Supabase Storage] Signed URL failed:', error.message);
    return null;
  }
  return data.signedUrl;
}
