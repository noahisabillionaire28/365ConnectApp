---
name: Messaging data layer
description: How direct messaging is implemented — conversations/messages tables, hooks, and realtime.
---

# Messaging data layer

## Architecture
- Backed by a `conversations` table (participant_a_id / participant_b_id / shift_id / last_message / last_message_at) plus a `messages` table (conversation_id / sender_id / body / read_at / attachments)
- `conversations` can optionally link to a `shift_id` for shift-specific threads; DMs started from a profile have `shift_id = null`
- `getOrCreateDirectConversation(myId, otherId)` in `src/hooks/useConversations.ts` finds an existing DM or creates one, returning a `conversationId`
- `useConversations()` lists all conversations for the current user with the other participant, shift title, and unread flag, live via Realtime subscription on both `conversations` and `messages`
- `useMessages(conversationId)` in `src/hooks/useMessages.ts` paginates a single thread's messages with live INSERTs and read receipts (not the same shape as an earlier per-user sender/recipient design — that approach was superseded)

## Routing
- `/messages` → `MessagesScreen` (conversation list)
- `/messages/:conversationId` → `ChatScreen` (thread view, supports text/image/video/voice attachments)
- Profile "Message" buttons call `getOrCreateDirectConversation` then navigate to `/messages/:conversationId`

**Why:**
Conversations are modeled as their own table (not derived by grouping raw messages by sender/recipient) so a thread can carry metadata — linked shift, last-message preview, unread state — without recomputing it from the full message log on every load.
