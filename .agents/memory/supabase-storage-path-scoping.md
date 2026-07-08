---
name: Storage RLS must bind to the resource, not the uploader
description: For private Supabase Storage buckets, namespace object paths by the shared resource (e.g. conversation id) rather than the uploader's user id, or RLS checks based on "shares any resource with the uploader" leak unrelated content.
---

When building a private-media storage policy (e.g. chat attachments) that needs to authorize more
than one user, the natural first instinct is to namespace object paths by the *uploader's* id
(`${userId}/kind/file.ext`) and write an RLS SELECT policy like "the uploader themself, OR someone
who shares an existing relationship (a conversation) with that uploader."

**Why:** That policy is a privilege-escalation footgun: if user A and user B share exactly one
conversation, B gets read access to *every* object A has ever uploaded to that bucket, including
attachments from A's completely unrelated conversations with other people. An architect review
caught this twice — first flagging a fully-open `auth.role() = 'authenticated'` policy, then this
narrower-but-still-wrong "shares any relationship" version — before the correct fix landed.

**How to apply:** Namespace the storage path by the specific shared resource the access should be
scoped to (e.g. `${conversationId}/kind/file.ext`), and write the RLS policy as "does a row exist in
the resource table whose id matches this path's first folder segment, AND is the requester a
participant of THAT SPECIFIC row" — never "does the requester have *any* relationship with the
object's owner." Apply this pattern to any future private multi-party bucket (group chat media,
shared-project files, etc).
