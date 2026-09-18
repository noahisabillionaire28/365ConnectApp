import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { ConversationRow, ConversationMember, UserRow } from '@/lib/supabase';

export type OtherParticipant = Pick<UserRow, 'id' | 'username' | 'photo_url' | 'role'>;

export type ConversationWithOther = ConversationRow & {
  /** The other person in a DM (null for group chats). */
  other: OtherParticipant | null;
  shiftTitle: string | null;
  unread: boolean;
  isGroup: boolean;
  /** Display name: @username for DMs, the shift title for groups. */
  displayName: string;
  members: ConversationMember[];
  participant_a_username?: string | null;
  participant_a_photo?: string | null;
  participant_b_username?: string | null;
  participant_b_photo?: string | null;
};

type ApiConversation = ConversationRow & {
  participant_a_username?: string | null;
  participant_a_photo?: string | null;
  participant_a_role?: string | null;
  participant_b_username?: string | null;
  participant_b_photo?: string | null;
  participant_b_role?: string | null;
};

export function shapeConversation(c: ApiConversation, myId: string): ConversationWithOther {
  const isGroup = !!c.is_group;
  const isA = c.participant_a_id === myId;
  const otherId       = isGroup ? null : (isA ? c.participant_b_id : c.participant_a_id);
  const otherUsername = isA ? c.participant_b_username : c.participant_a_username;
  const otherPhoto    = isA ? c.participant_b_photo    : c.participant_a_photo;
  const otherRole     = isA ? c.participant_b_role     : c.participant_a_role;
  const other = otherId ? {
    id: otherId, username: otherUsername ?? null, photo_url: otherPhoto ?? null,
    role: (otherRole ?? 'worker') as UserRow['role'],
  } : null;
  return {
    ...c,
    other,
    isGroup,
    members: c.members ?? [],
    shiftTitle: c.shift_title ?? null,
    displayName: isGroup ? (c.title || c.shift_title || 'Shift chat') : (other?.username ? `@${other.username}` : 'Unknown user'),
    unread: (c.unread_count ?? 0) > 0,
  };
}

/**
 * Standalone named export for direct use in pages:
 *   import { getOrCreateDirectConversation } from '@/hooks/useConversations';
 */
export async function getOrCreateDirectConversation(
  userId: string,
  otherUserId: string,
  shiftId?: string,
): Promise<string | null> {
  try {
    const conv = await apiClient(userId).post<ConversationRow>('/conversations', {
      other_user_id: otherUserId,
      shift_id:      shiftId,
    });
    return conv.id;
  } catch (e) {
    console.error('[getOrCreateDirectConversation] failed:', e);
    return null;
  }
}

/** Open (creating if needed) the group chat for a shift. Returns the conversation id or an error. */
export async function openShiftGroupChat(userId: string, shiftId: string): Promise<{ id: string | null; error: string | null }> {
  try {
    const conv = await apiClient(userId).post<ConversationRow>(`/conversations/shift/${shiftId}`, {});
    return { id: conv.id, error: null };
  } catch (e) {
    return { id: null, error: e instanceof Error ? e.message : 'Could not open the shift chat.' };
  }
}

export function useConversations(opts: { archived?: boolean } = {}) {
  const { user } = useAuth();
  const [items, setItems]       = useState<ConversationWithOther[]>([]);
  const [isLoading, setLoading] = useState(true);
  const archived = !!opts.archived;

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    try {
      const rows = await apiClient(user.id).get<ApiConversation[]>(`/conversations${archived ? '?archived=1' : ''}`);
      setItems(rows.map((c) => shapeConversation(c, user.id)));
    } catch (e) {
      console.error('[useConversations] fetch failed:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id, archived]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Live updates + a polling fallback for hosts where SSE drops.
  useEffect(() => {
    const off = onSSE<{ conversationId: string }>('conversation_update', () => { void load(); });
    const t = setInterval(() => { if (document.visibilityState === 'visible') void load(); }, 20_000);
    return () => { off(); clearInterval(t); };
  }, [load]);

  const getOrCreate = useCallback(
    async (otherUserId: string, shiftId?: string): Promise<string | null> => {
      if (!user?.id) return null;
      const id = await getOrCreateDirectConversation(user.id, otherUserId, shiftId);
      if (id) await load();
      return id;
    },
    [user?.id, load],
  );

  /** Per-user thread settings: mute / pin / archive. */
  const setPrefs = useCallback(async (conversationId: string, prefs: { muted?: boolean; pinned?: boolean; archived?: boolean }): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    setItems((prev) => prev.map((c) => (c.id === conversationId ? {
      ...c,
      is_muted: prefs.muted ?? c.is_muted,
      is_pinned: prefs.pinned ?? c.is_pinned,
      is_archived: prefs.archived ?? c.is_archived,
    } : c)));
    try {
      await apiClient(user.id).patch(`/conversations/${conversationId}/prefs`, prefs);
      await load();
      return null;
    } catch (e) {
      await load();
      return e instanceof Error ? e.message : 'Could not update this conversation.';
    }
  }, [user?.id, load]);

  /** Remove a thread from my list (the other side keeps their copy). */
  const deleteConversation = useCallback(async (conversationId: string): Promise<string | null> => {
    if (!user?.id) return 'Not signed in.';
    setItems((prev) => prev.filter((c) => c.id !== conversationId));
    try {
      await apiClient(user.id).delete(`/conversations/${conversationId}`);
      return null;
    } catch (e) {
      await load();
      return e instanceof Error ? e.message : 'Could not delete this conversation.';
    }
  }, [user?.id, load]);

  return { items, isLoading, refetch: load, getOrCreateConversation: getOrCreate, setPrefs, deleteConversation };
}
