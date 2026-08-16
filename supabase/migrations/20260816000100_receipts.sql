-- One visit to a shop usually produces one piece of paper covering several jobs. Until
-- now every service carried its own photo, so a single receipt had to be uploaded once
-- per line item. A receipt is now its own row, and services point at it.

set search_path = maintenance, public;

create table receipt (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  storage_path text,
  performed_on date not null,
  odometer int,
  shop_name text,
  total_cost_cents int,
  notes text,
  created_at timestamptz default now()
);
create index on receipt (vehicle_id, performed_on desc);
alter table receipt enable row level security;
create policy own_child on receipt for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

grant select, insert, update, delete on receipt to authenticated;

-- Nulled rather than cascaded: losing the paperwork should not erase the fact that the
-- work was done.
alter table service_log add column receipt_id uuid references receipt(id) on delete set null;
create index on service_log (receipt_id);
