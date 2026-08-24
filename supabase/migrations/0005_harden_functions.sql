-- Harden the two SECURITY DEFINER trigger functions: pin search_path and remove
-- them from the public REST RPC surface. Triggers still fire normally.
alter function public.handle_new_auth_user() set search_path = public;
alter function public.update_user_rating()   set search_path = public;
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.update_user_rating()   from public, anon, authenticated;
