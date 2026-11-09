-- public.rls_auto_enable() is created by the dashboard option "Enable automatic RLS" (cloud only).
-- It is an event trigger function (fires after DDL), never meant to be called through the API.
-- Security Advisor flagged EXECUTE for anon / authenticated, so take it away.
-- Guarded: the function does not exist on a local database.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;
