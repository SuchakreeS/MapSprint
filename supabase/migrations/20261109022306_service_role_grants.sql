-- The server (Edge Functions, service_role) writes stats, XP, cells and badges.
-- Granted explicitly so it doesn't depend on the dashboard's "auto expose" setting.
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
