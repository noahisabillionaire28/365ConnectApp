import { useEffect, useState, useCallback } from 'react';
import { supabase, type ConversationRow, type UserRow } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export type OtherParticipant = Pick<UserRow, 'id' | 'username' | 'photo_url' | 'role'>;

export type ConversationWithOther = ConversationRow & {
  other: OtherParticipant | null;
  shiftTitle: string | null;
  unread: boolean;
};

/** All conversations the current user is part of, sorted by most recent activity. */
export function useConversations() {
  const { user } = useAuth();
  const [items, setItems]       = useState<ConversationWithOther[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);

    const { data: convos, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_a_id.eq.${user.id},participant_b_id.eq.${user.id}`)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[useConversations] fetch failed:', error.message);
      setItems([]);
      setLoading(false);
      return;
    }

    const rows = (convos ?? []) as ConversationRow[];
    if (rows.length === 0) { setItems([]); setLoading(false); return; }

    const otherIds  = rows.map((c) => (c.participant_a_id === user.id ? c.participant_b_id : c.participant_a_id));
    const shiftIds  = rows.map((c) => c.shift_id).filter((id): id is string => !!id);

    const [usersRes, shiftsRes, unreadRes] = await Promise.all([
      supabase.from('users').select('id, username, photo_url, role').in('id', otherIds),
      shiftIds.length
        ? supabase.from('shifts').select('id, title').in('id', shiftIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('messages').select('conversation_id, sender_id, read_at')
        .in('conversation_id', rows.map((c) => c.id))
        .is('read_at', null),
    ]);

    const userMap  = new Map((usersRes.data ?? []).map((u) => [u.id, u as OtherParticipant]));
    const shiftMap = new Map(((shiftsRes.data ?? []) as { id: string; title: string }[]).map((s) => [s.id, s.title]));
    const unreadSet = new Set(
      ((unreadRes.data ?? []) as { conversation_id: string; sender_id: string }[])
        .filter((m) => m.sender_id !== user.id)
        .map((m) => m.conversation_id),
    );

    setItems(rows.map((c) => ({
      ...c,
      other: userMap.get(c.participant_a_id === user.id ? c.participant_b_id : c.participant_a_id) ?? null,
      shiftTitle: c.shift_id ? shiftMap.get(c.shift_id) ?? null : null,
      unread: unreadSet.has(c.id),
    })));
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`conversations-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => void load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id, load]);

  return { items, isLoading, refetch: load };
}

/** Finds an existing DM (no shift) between two users, or creates one. */
export async function getOrCreateDirectConversation(myId: string, otherId: string): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from('conversations')
    .select('id')
    .is('shift_id', null)
    .or(`and(participant_a_id.eq.${myId},participant_b_id.eq.${otherId}),and(participant_a_id.eq.${otherId},participant_b_id.eq.${myId})`)
    .limit(1)
    .maybeSingle();

  if (findError) {
    console.error('[getOrCreateDirectConversation] lookup failed:', findError.message);
    return null;
  }
  if (existing) return existing.id;

  const { data: created, error: insertError } = await supabase
    .from('conversations')
    .insert({ participant_a_id: myId, participant_b_id: otherId })
    .select('id')
    .single();

  if (insertError) {
    console.error('[getOrCreateDirectConversation] create failed:', insertError.message);
    return null;
  }
  return created.id;
}
