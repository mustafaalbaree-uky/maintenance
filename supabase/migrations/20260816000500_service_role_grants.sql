-- Only `authenticated` was granted access to this schema, so anything server side, such
-- as an Edge Function, a cron job, or an admin script, was refused before RLS was even
-- consulted. The service role bypasses RLS by design; it still needs the grants.

set search_path = maintenance, public;

grant usage on schema maintenance to service_role;
grant all on all tables in schema maintenance to service_role;
grant all on all sequences in schema maintenance to service_role;
grant execute on all functions in schema maintenance to service_role;

alter default privileges in schema maintenance
  grant all on tables to service_role;
