-- A person's name is its own column. Until now a poster's "name" was stored
-- in bio (and mirrored into company_name), so whatever someone wrote as a
-- bio could end up as the business label on their shifts. From here on:
--   users.name          the person's name (every role)
--   users.company_name  the business or agency they post as (posters)
--   users.bio           free text about them, never used as a label
-- Shifts no longer freeze company_name at creation; the API derives the
-- poster's label live from users, so a name change shows up everywhere.

alter table public.users add column if not exists name text;

-- Posters' bios were used as names (admins post shifts too). Keep a bio as the name only when it
-- plainly is one (a few plain words); anything longer or sentence-like
-- stays a bio and the person is asked for their name.
update public.users
   set name = btrim(bio)
 where role in ('client', 'staffer', 'admin')
   and name is null
   and bio is not null
   and btrim(bio) <> ''
   and length(btrim(bio)) <= 40
   and btrim(bio) !~ '[&,;:!?/\d\n]'
   and array_length(regexp_split_to_array(btrim(bio), '\s+'), 1) <= 4;

-- A bio that is just a copy of the business or the name was never a bio.
update public.users
   set bio = null
 where role in ('client', 'staffer', 'admin')
   and bio is not null
   and (bio = company_name or bio = name);

-- Clients had their full name (or bio) copied into company_name at sign-up.
update public.users
   set company_name = null
 where role in ('client', 'admin')
   and company_name is not null
   and (company_name = name or company_name = bio);

-- Shift labels copied from the poster at creation are dropped so they are
-- derived from the poster's current name; a label typed per shift stays.
update public.shifts s
   set company_name = null
  from public.users u
 where s.client_id = u.id
   and s.company_name is not null
   and (s.company_name = u.company_name
     or s.company_name = u.name
     or s.company_name = u.bio
     or s.company_name = '@' || u.username);
