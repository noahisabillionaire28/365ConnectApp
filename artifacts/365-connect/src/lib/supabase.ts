import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[365 Connect] Supabase is not configured. ' +
    'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your Replit Secrets.'
  );
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);

// ─── Typed table row shapes ────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  email: string;
  role: 'worker' | 'client';
  username: string | null;
  photo_url: string | null;
  bio: string | null;
  job_types: string[];
  certifications: string[];
  rating: number;
  created_at: string;
};

export type ShiftRow = {
  id: string;
  client_id: string;
  title: string;
  job_type: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  pay_rate: number | null;
  location: string | null;
  dress_code: string | null;
  point_of_contact: string | null;
  status: 'open' | 'filled' | 'completed' | 'cancelled';
  spots_available: number;
  created_at: string;
};

export type ApplicationRow = {
  id: string;
  shift_id: string;
  worker_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  match_score: number | null;
  created_at: string;
};

export type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  image_url: string | null;
  read_at: string | null;
  created_at: string;
};

export type ReviewRow = {
  id: string;
  shift_id: string;
  from_user_id: string;
  to_user_id: string;
  rating: number;
  tags: string[];
  created_at: string;
};

// ─── Storage helpers ───────────────────────────────────────────────────────────

export async function uploadAvatar(userId: string, file: File): Promise<string | null> {
  const ext = file.name.split('.').pop() ?? 'jpg';
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
  const ext = file.name.split('.').pop() ?? 'jpg';
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
