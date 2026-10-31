-- public_profiles was a SECURITY DEFINER view readable by every signed-in
-- user straight through Supabase's REST API. The app never reads it (every
-- profile read goes through the API, which checks who is asking), so a
-- direct query could only ever have been used to scrape the whole user
-- table. Make the view run as the caller and take the grant away.
alter view public.public_profiles set (security_invoker = true);
revoke all on public.public_profiles from anon, authenticated;
