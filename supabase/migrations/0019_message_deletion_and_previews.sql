-- 0019_message_deletion_and_previews.sql
-- 1. Soft-delete for chat messages (iMessage-style "deleted this message" note).
--    The row stays so both sides see the placeholder in the right spot; the
--    content itself is cleared by the API when it sets deleted_at.
alter table public.messages
  add column if not exists deleted_at timestamptz;

-- 2. Conversation previews. The live database never had the trigger that keeps
--    conversations.last_message / last_message_at fresh, so every thread showed
--    "Say hello" with no time. The API now maintains these on send/delete;
--    this backfills existing threads from their latest message.
update public.conversations c
set    last_message = coalesce(
         m.text,
         case
           when m.deleted_at is not null then 'Message deleted'
           when m.image_url is not null then '📷 Photo'
           when m.video_url is not null then '🎥 Video'
           when m.voice_url is not null then '🎤 Voice message'
           else ''
         end),
       last_message_at = m.created_at
from (
  select distinct on (conversation_id) conversation_id, text, image_url, video_url, voice_url, deleted_at, created_at
  from   public.messages
  order  by conversation_id, created_at desc
) m
where m.conversation_id = c.id
  and (c.last_message_at is null or c.last_message_at < m.created_at);

create index if not exists messages_conversation_unread_idx
  on public.messages(conversation_id, sender_id)
  where read_at is null and deleted_at is null;
