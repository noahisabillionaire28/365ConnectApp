import { createClient } from '@supabase/supabase-js';
import { DEFAULT_SHIFT_TZ } from './timezone';

// ─── Feed UI types (no mock data — all data comes from Supabase) ──────────────

export type StoryWorker = {
  id: string;
  username: string;
  photoUrl: string;
  isPremium: boolean;
  isAvailable: boolean;
};

export type MockShift = {
  id: string;
  /** Event this shift is for (Wedding, Corporate, …); null on legacy shifts. */
  eventType: string | null;
  jobType: string;
  /** All job types this shift accepts (job-type intersection filtering, AI match). */
  jobTypes: string[];
  companyName: string;
  coverImage: string;
  payRate: number;
  payPeriod: 'hr' | 'day' | 'event';
  date: string;
  startTime: string;
  endTime: string;
  /** Raw ISO timestamptz for the shift start — used for day-of-week matching, never displayed directly. */
  startTimeISO: string;
  /** Raw ISO timestamptz for the shift end — used for lifecycle state. */
  endTimeISO: string;
  /** IANA zone of the venue; times are displayed in this zone. */
  timezone: string;
  /** When set, this shift is one position of a multi-position event. */
  eventId: string | null;
  distanceMiles: number;
  spotsAvailable: number;
  spotsTotal: number;
  /** true when workers can grab this shift instantly with no approval. */
  instantClaim: boolean;
  /** true when only the agency's roster can see and take this shift. */
  rosterOnly: boolean;
  location: string;
  aiMatchPct: number;
  description: string;
  requirements: string[];
  dressCode: string;
  dressCodeItems: string[];
  pointOfContact: string;
  contactPhone: string;
  lat: number;
  lng: number;
  clientId: string;
  /** The poster's @username (links to their public profile); null when unknown. */
  clientUsername: string | null;
  /** The poster's average rating; null when they have none yet. */
  clientRating: number | null;
  status: 'open' | 'filled' | 'cancelled' | 'completed';
};

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

// ─── Access-token cache ───────────────────────────────────────────────────────
// api.ts attaches the current access token to every /api request. Calling
// supabase.auth.getSession() on each request is unreliable: it can briefly
// return null during hydration and can BLOCK on supabase-js's navigator-lock
// (used to serialise token refreshes). When that happened, requests went out
// with no token → 401 "Unauthorized — no-token" and authenticated pages hung on
// a blank skeleton. Instead we keep the latest token in this module variable,
// refreshed by onAuthStateChange (which fires INITIAL_SESSION on load and
// TOKEN_REFRESHED as the token rotates), and read it synchronously.
let currentAccessToken: string | null = null;

/** The latest Supabase access token, or null when signed out. Synchronous. */
export function getCachedAccessToken(): string | null {
  return currentAccessToken;
}

supabase.auth.onAuthStateChange((_event, session) => {
  currentAccessToken = session?.access_token ?? null;
});

// Seed once from persisted storage, covering the window before the first
// onAuthStateChange event fires on a fresh page load.
void supabase.auth
  .getSession()
  .then(({ data }) => { if (data.session?.access_token) currentAccessToken = data.session.access_token; })
  .catch(() => { /* ignore — cache stays null until an auth event arrives */ });

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
  /** Phase 11 — admin moderation status. 'active' | 'suspended' | 'flagged' */
  status: 'active' | 'suspended' | 'flagged' | null;
  is_banned: boolean;
  followers_count: number;
  following_count: number;
};

/** Matches the actual `shifts` table after Phase 2 additions */
export type ShiftRow = {
  id: string;
  client_id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_type: string | null;
  job_type: string;
  job_types: string[];
  pay_rate: number | null;
  pay_period: string;
  start_time: string;       // ISO timestamptz from DB (a real instant)
  end_time: string;         // ISO timestamptz from DB (a real instant)
  timezone?: string | null; // IANA zone of the venue (null on legacy rows → America/New_York)
  date: string | null;      // optional display-date override; usually null — derive from start_time
  spots_available: number;  // total slots posted (despite the name, this is the total, not the remainder — remainder = spots_available - spots_filled)
  spots_filled: number;
  instant_claim?: boolean | null;
  visibility?: 'public' | 'roster' | null;
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
  // Poster fields the API joins onto a shift
  client_username?: string | null;
  client_rating?: number | string | null;
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
  post_id: string | null;
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
  /** null for non-shift payments (e.g. Pro subscription). */
  shift_id: string | null;
  worker_id: string;
  /** 'shift_payment' | 'pro_subscription' — added Phase 10 */
  payment_type: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  created_at: string;
  shift_title?: string | null;
  company_name?: string | null;
  /** 'in' = earned by the worker; 'out' = paid by the client */
  direction?: 'in' | 'out';
  client_id?: string | null;
};

export type ConversationMember = {
  id: string;
  username: string | null;
  photo_url: string | null;
  role: string | null;
};

export type ConversationRow = {
  id: string;
  participant_a_id: string | null;
  participant_b_id: string | null;
  shift_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
  /** Shift group chat (members in participant_ids / members). */
  is_group?: boolean;
  title?: string | null;
  created_by?: string | null;
  participant_ids?: string[] | null;
  /** From the API: everyone in the thread. */
  members?: ConversationMember[];
  /** Messages from others I haven't opened yet (from the API). */
  unread_count?: number;
  is_muted?: boolean;
  is_pinned?: boolean;
  is_archived?: boolean;
  shift_title?: string | null;
  shift_start?: string | null;
  shift_end?: string | null;
  shift_status?: string | null;
  shift_owner_id?: string | null;
};

export type MessageReplyPreview = {
  id: string;
  sender_id: string;
  sender_username: string | null;
  preview: string;
};

export type MessageShiftCard = {
  id: string;
  title: string | null;
  job_type: string | null;
  start_time: string;
  end_time: string;
  pay_rate: number | string | null;
  pay_period: string | null;
  location: string | null;
  status: string;
  spots_available: number;
  spots_filled: number;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  /** 'user' | 'system' — system lines are "@x joined the shift chat" etc. */
  kind?: string;
  text: string | null;
  image_url: string | null;
  video_url: string | null;
  voice_url: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  shift_card_id?: string | null;
  reply_to_id?: string | null;
  reactions?: Record<string, string[]> | null;
  read_at: string | null;
  /** Set when the sender deleted the message; content fields are cleared. */
  deleted_at?: string | null;
  edited_at?: string | null;
  client_key?: string | null;
  created_at: string;
  /** Flattened sender info from the API (not a DB column). */
  sender_username?: string | null;
  sender_photo?: string | null;
  reply_to?: MessageReplyPreview | null;
  shift_card?: MessageShiftCard | null;
  /** Client-only delivery state for optimistic sends. */
  _status?: 'sending' | 'failed';
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

// Shift times are real instants tagged with the venue's IANA zone (see
// lib/timezone.ts). We render them in the venue zone so every viewer sees the
// time as it was entered ("6:00 PM"), while lifecycle logic compares instants.

function safeZone(tz?: string | null): string {
  const zone = tz || DEFAULT_SHIFT_TZ;
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return zone; } catch { return DEFAULT_SHIFT_TZ; }
}

/** "9:00 PM" format from an ISO timestamptz string, in the venue zone */
export function formatTime(iso: string, tz?: string | null): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: safeZone(tz),
  });
}

/** "Today" / "Tonight" / "Tomorrow" / "Mon Jul 8" from an ISO timestamptz string, in the venue zone */
export function friendlyDate(iso: string, tz?: string | null): string {
  const zone     = safeZone(tz);
  const d        = new Date(iso);
  const now      = new Date();
  const tomorrow = new Date(now.getTime() + 86_400_000);
  const dayKey   = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: zone }); // YYYY-MM-DD
  const hourIn   = Number(d.toLocaleTimeString('en-US', { timeZone: zone, hour12: false, hour: '2-digit' })) % 24;

  // A 9am shift is "Today", not "Tonight" — only evening starts get that label.
  if (dayKey(d) === dayKey(now))      return hourIn >= 17 ? 'Tonight' : 'Today';
  if (dayKey(d) === dayKey(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: zone,
  });
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
  // Postgres returns numeric columns as strings, so coerce and guard against
  // NaN — a string/NaN coordinate makes Google Maps drop the pin at nowhere.
  const rawLat         = row.lat != null ? Number(row.lat) : NaN;
  const rawLng         = row.lng != null ? Number(row.lng) : NaN;
  const lat            = Number.isFinite(rawLat) ? rawLat : MIAMI_BEACH.lat;
  const lng            = Number.isFinite(rawLng) ? rawLng : MIAMI_BEACH.lng;
  const spotsAvailable = Math.max(0, (row.spots_available ?? 1) - (row.spots_filled ?? 0));

  return {
    id:             row.id,
    eventType:      row.event_type ?? null,
    jobType:        primaryType,
    jobTypes:       row.job_types?.length ? row.job_types : [primaryType],
    companyName:    row.company_name    ?? 'Private Client',
    coverImage:     row.cover_image     ?? COVER_FALLBACKS[primaryType] ?? COVER_FALLBACKS.default,
    payRate:        Number(row.pay_rate ?? 0),
    payPeriod:      (row.pay_period as 'hr' | 'day' | 'event') ?? 'hr',
    date:           friendlyDate(row.start_time, row.timezone),
    startTime:      formatTime(row.start_time, row.timezone),
    endTime:        formatTime(row.end_time, row.timezone),
    startTimeISO:   row.start_time,
    endTimeISO:     row.end_time,
    timezone:       row.timezone || DEFAULT_SHIFT_TZ,
    eventId:        (row as { event_id?: string | null }).event_id ?? null,
    distanceMiles:  Math.round(haversineMiles(refCoords.lat, refCoords.lng, lat, lng) * 10) / 10,
    spotsAvailable,
    spotsTotal:     row.spots_available ?? 1,
    instantClaim:   !!row.instant_claim,
    rosterOnly:     row.visibility === 'roster',
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
    clientUsername: row.client_username ?? null,
    clientRating:   row.client_rating != null && Number(row.client_rating) > 0 ? Number(row.client_rating) : null,
    status:         row.status,
  };
}

/**
 * Guarantee a MockShift has every field the UI dereferences, regardless of
 * where it came from (fresh API row, or an object restored from an on-device
 * cache written by an older build that predates some fields). Cheap, and it
 * turns a would-be render crash into a normal page.
 */
export function hardenShift(s: MockShift): MockShift {
  const raw = s as Partial<MockShift> & { id: string };
  const primaryType = raw.jobType || 'Event Staff';
  const strArr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  return {
    ...raw,
    id:             raw.id,
    eventType:      raw.eventType ?? null,
    jobType:        primaryType,
    jobTypes:       strArr(raw.jobTypes).length ? strArr(raw.jobTypes) : [primaryType],
    companyName:    raw.companyName || 'Private Client',
    coverImage:     raw.coverImage || COVER_FALLBACKS[primaryType] || COVER_FALLBACKS.default,
    payRate:        Number(raw.payRate ?? 0) || 0,
    payPeriod:      raw.payPeriod ?? 'hr',
    date:           raw.date ?? '',
    startTime:      raw.startTime ?? '',
    endTime:        raw.endTime ?? '',
    startTimeISO:   raw.startTimeISO ?? '',
    endTimeISO:     raw.endTimeISO ?? '',
    timezone:       raw.timezone || DEFAULT_SHIFT_TZ,
    eventId:        raw.eventId ?? null,
    distanceMiles:  Number.isFinite(raw.distanceMiles) ? (raw.distanceMiles as number) : 0,
    spotsAvailable: Number(raw.spotsAvailable ?? 0) || 0,
    spotsTotal:     Number(raw.spotsTotal ?? 1) || 1,
    instantClaim:   !!raw.instantClaim,
    rosterOnly:     !!raw.rosterOnly,
    location:       raw.location ?? '',
    aiMatchPct:     Number(raw.aiMatchPct ?? 85) || 85,
    description:    raw.description ?? '',
    requirements:   strArr(raw.requirements),
    dressCode:      raw.dressCode ?? '',
    dressCodeItems: strArr(raw.dressCodeItems),
    pointOfContact: raw.pointOfContact ?? '',
    contactPhone:   raw.contactPhone ?? '',
    lat:            Number.isFinite(raw.lat) ? (raw.lat as number) : MIAMI_BEACH.lat,
    lng:            Number.isFinite(raw.lng) ? (raw.lng as number) : MIAMI_BEACH.lng,
    clientId:       raw.clientId ?? '',
    clientUsername: raw.clientUsername ?? null,
    clientRating:   Number.isFinite(raw.clientRating) && (raw.clientRating as number) > 0 ? (raw.clientRating as number) : null,
    status:         raw.status ?? 'open',
  };
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/avatar.${ext}`;
  const { error } = await supabase.storage
    .from('avatars')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Avatar upload failed: ${error.message}`);
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export async function uploadPostPhoto(userId: string, file: File): Promise<string> {
  const ext  = file.name.split('.').pop() ?? 'jpg';
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('post-photos')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Post photo upload failed: ${error.message}`);
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
