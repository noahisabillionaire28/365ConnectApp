-- Close the data-exposure hole: these 6 tables had RLS disabled, so anyone with
-- the public anon key could read/write them directly. They are only ever accessed
-- through the service-role backend (which bypasses RLS), so enabling RLS with no
-- policies blocks all direct public access without affecting the app.
alter table public.conversations  enable row level security;
alter table public.disputes       enable row level security;
alter table public.notifications  enable row level security;
alter table public.payments       enable row level security;
alter table public.shift_requests enable row level security;
alter table public.time_entries   enable row level security;
