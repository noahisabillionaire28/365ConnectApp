-- 0036: Terms of Service / Privacy Policy acceptance.
--
-- Every acceptance is a row (which document, which version, when, from where);
-- the latest accepted version is also denormalised onto users so the API can
-- gate writes with one indexed read (see api-server middleware requireLegal).
--
-- Idempotent: safe to re-run.

create table if not exists public.legal_acceptances (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users (id) on delete cascade,
  document    text not null check (document in ('terms', 'privacy')),
  version     text not null,
  accepted_at timestamptz not null default now(),
  ip          text,
  user_agent  text
);

create index if not exists legal_acceptances_user_document_idx
  on public.legal_acceptances (user_id, document, accepted_at desc);

-- Service role only (the API writes and reads these); no policies on purpose.
alter table public.legal_acceptances enable row level security;
comment on table public.legal_acceptances is
  'RLS on, no policies: service role only (deny-all for anon/authenticated). One row per accepted document version.';

alter table public.users add column if not exists terms_version   text;
alter table public.users add column if not exists privacy_version text;
comment on column public.users.terms_version   is 'Latest Terms of Service version the user accepted (see legal_acceptances).';
comment on column public.users.privacy_version is 'Latest Privacy Policy version the user accepted (see legal_acceptances).';
