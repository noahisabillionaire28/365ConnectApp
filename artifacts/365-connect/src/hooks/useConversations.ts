import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { onSSE } from '@/lib/sseEmitter';
import type { ConversationRow, UserRow } from '@/lib/supabase';

export type OtherParticipant = Pick<UserRow, 'id' | 'username' | 'photo_url' | 'role'>;

export type ConversationWithOther = ConversationRow & {
  other: OtherParticipant | null;
  shiftTitle: string | null;
  unread: boolean;
  participant_a_username?: string | null;
  participant_a_photo?: string | null;
  participant_b_username?: string | null;
  participant_b_photo?: string | null;
};

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

export function useConversations() {
  const { user } = useAuth();
  const [items, setItems]       = useState<ConversationWithOther[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) { setItems([]); setLoading(false); return; }
    setLoading(true);
    try {
      const rows = await apiClient(user.id).get<(ConversationRow & {
        participant_a_username?: string | null;
        participant_a_photo?: string | null;
        participant_a_role?: string | null;
        participant_b_username?: string | null;
        participant_b_photo?: string | null;
        participant_b_role?: string | null;
        shift_title?: string | null;
      })[]>('/conversations');

      const withOther: ConversationWithOther[] = rows.map((c) => {
        const isA = c.participant_a_id === user.id;
        const otherId       = isA ? c.participant_b_id : c.participant_a_id;
        const otherUsername = isA ? c.participant_b_username : c.participant_a_username;
        const otherPhoto    = isA ? c.participant_b_photo    : c.participant_a_photo;
        const otherRole     = isA ? c.participant_b_role     : c.participant_a_role;

        return {
          ...c,
          other: otherId ? {
            id:        otherId,
            username:  otherUsername ?? null,
            photo_url: otherPhoto    ?? null,
            role:      (otherRole    ?? 'worker') as UserRow['role'],
          } : null,
          shiftTitle: c.shift_title ?? null,
          unread: false,
        };
      });

      setItems(withOther);
    } catch (e) {
      console.error('[useConversations] fetch failed:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Live updates: reload conversation list when any conversation changes
  useEffect(() => {
    return onSSE<{ conversationId: string }>('conversation_update', () => {
      void load();
    });
  }, [load]);

  /** Convenience method on the hook instance */
  const getOrCreate = useCallback(
    async (otherUserId: string, shiftId?: string): Promise<string | null> => {
      if (!user?.id) return null;
      const id = await getOrCreateDirectConversation(user.id, otherUserId, shiftId);
      if (id) await load();
      return id;
    },
    [user?.id, load],
  );

  return { items, isLoading, refetch: load, getOrCreateConversation: getOrCreate };
}
