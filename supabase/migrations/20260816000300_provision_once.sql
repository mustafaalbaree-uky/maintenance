-- Provisioning was not guarded, so calling it twice for one car produced two of every
-- schedule item, watch item, task and warranty. It now returns quietly if the car has
-- already been set up.

set search_path = maintenance, public;

create or replace function maintenance.provision_vehicle(p_vehicle_id uuid, p_template_set text default 'g70_33t')
returns void
language plpgsql
set search_path = maintenance, public
as $fn$
begin
  if exists (select 1 from maintenance_item where vehicle_id = p_vehicle_id) then
    return;
  end if;

  perform maintenance.provision_vehicle_unchecked(p_vehicle_id, p_template_set);
end;
$fn$;
