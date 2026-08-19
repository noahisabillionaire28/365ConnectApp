-- exec_sql — run a parameterised SQL statement and return its rows as JSON.
--
-- This backs the `pool` shim in artifacts/api-server/src/lib/db.ts, which lets
-- the API server keep its raw-SQL route handlers while talking to the database
-- through the Supabase service-role REST client (no DATABASE_URL / direct
-- Postgres password required).
--
-- Parameters ($1, $2, ...) are supplied as text and substituted as properly
-- escaped SQL literals via quote_nullable(), so injection safety matches the
-- original parameterised `pg` queries. Substitution runs from the highest
-- index down so that $1 never matches inside $10, $11, ...
--
-- SECURITY: SECURITY DEFINER so it runs with owner privileges; EXECUTE is
-- granted ONLY to service_role (the server's key) and revoked from anon and
-- authenticated so it can never be reached through the public API.

create or replace function public.exec_sql(
  p_query        text,
  p_params       text[]  default '{}',
  p_returns_rows boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sql    text := coalesce(p_query, '');
  v_i      int;
  v_result jsonb;
begin
  if p_params is not null then
    for v_i in reverse coalesce(array_length(p_params, 1), 0) .. 1 loop
      v_sql := replace(v_sql, '$' || v_i::text, quote_nullable(p_params[v_i]));
    end loop;
  end if;

  if p_returns_rows then
    execute
      'with __q as (' || v_sql || ') ' ||
      'select coalesce(jsonb_agg(to_jsonb(__q)), ''[]''::jsonb) from __q'
      into v_result;
    return coalesce(v_result, '[]'::jsonb);
  else
    execute v_sql;
    return '[]'::jsonb;
  end if;
end;
$$;

revoke all on function public.exec_sql(text, text[], boolean) from public;
revoke all on function public.exec_sql(text, text[], boolean) from anon;
revoke all on function public.exec_sql(text, text[], boolean) from authenticated;
grant execute on function public.exec_sql(text, text[], boolean) to service_role;
