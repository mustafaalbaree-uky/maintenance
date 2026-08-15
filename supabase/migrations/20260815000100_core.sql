-- Maintenance: core schema.
-- RLS is enabled on every table in the same statement block that creates it.

-- ============ CORE ============

create table vehicle (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) default auth.uid(),
  vin text,
  year int not null,
  make text not null,
  model text not null,
  trim text,
  engine_note text,
  drivetrain text,
  fuel_note text,
  in_service_date date,
  purchase_date date not null,
  purchase_odometer int not null,
  plan_end_odometer int,
  nickname text,
  created_at timestamptz default now()
);
alter table vehicle enable row level security;
create policy own_vehicle on vehicle for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create table odometer_reading (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  reading_date date not null,
  miles int not null,
  source text not null default 'manual',
  created_at timestamptz default now(),
  unique (vehicle_id, reading_date)
);
create index on odometer_reading (vehicle_id, reading_date desc);
alter table odometer_reading enable row level security;
create policy own_child on odometer_reading for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ SCHEDULE ============

create table maintenance_template (
  id uuid primary key default gen_random_uuid(),
  template_set text not null,
  name text not null,
  category text not null,
  interval_miles int,
  interval_months int,
  plain_language text not null,
  why_it_matters text not null,
  note text,
  typical_cost_low_cents int,
  typical_cost_high_cents int,
  prevents_label text,
  prevents_cost_low_cents int,
  prevents_cost_high_cents int,
  sort_order int not null default 0
);
alter table maintenance_template enable row level security;
create policy read_templates on maintenance_template for select
  using (auth.role() = 'authenticated');

create table maintenance_item (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  template_id uuid references maintenance_template(id),
  name text not null,
  category text not null,
  interval_miles int,
  interval_months int,
  plain_language text not null,
  why_it_matters text not null,
  note text,
  typical_cost_low_cents int,
  typical_cost_high_cents int,
  prevents_label text,
  prevents_cost_low_cents int,
  prevents_cost_high_cents int,
  anchor_odometer int not null,
  anchor_date date not null,
  active boolean not null default true,
  sort_order int not null default 0
);
create index on maintenance_item (vehicle_id, sort_order);
alter table maintenance_item enable row level security;
create policy own_child on maintenance_item for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ HISTORY ============

create table service_log (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  maintenance_item_id uuid references maintenance_item(id),
  performed_on date not null,
  odometer int not null,
  description text not null,
  shop_name text,
  cost_cents int,
  is_warranty_claim boolean not null default false,
  claim_status text,
  deductible_paid_cents int,
  receipt_path text,
  notes text,
  created_at timestamptz default now()
);
create index on service_log (vehicle_id, performed_on desc);
alter table service_log enable row level security;
create policy own_child on service_log for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ KNOWN FAILURE POINTS ============

create table watch_template (
  id uuid primary key default gen_random_uuid(),
  template_set text not null,
  name text not null,
  window_start_miles int not null,
  window_end_miles int not null,
  est_cost_low_cents int,
  est_cost_high_cents int,
  coverage_guess text not null,
  coverage_note text,
  symptoms text not null,
  first_check text not null,
  plain_language text not null,
  severity text not null default 'normal'
);
alter table watch_template enable row level security;
create policy read_templates on watch_template for select
  using (auth.role() = 'authenticated');

create table watch_item (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  watch_template_id uuid references watch_template(id),
  name text not null,
  window_start_miles int not null,
  window_end_miles int not null,
  est_cost_low_cents int,
  est_cost_high_cents int,
  coverage_guess text not null,
  coverage_note text,
  symptoms text not null,
  first_check text not null,
  plain_language text not null,
  severity text not null default 'normal',
  status text not null default 'watching',
  resolved_service_log_id uuid references service_log(id)
);
create index on watch_item (vehicle_id, window_start_miles);
alter table watch_item enable row level security;
create policy own_child on watch_item for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ WARRANTY ============

create table warranty (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  name text not null,
  ends_at_miles int,
  ends_at_date date,
  cap_is_total_odometer boolean,
  starts_from_odometer int,
  deductible_cents int,
  reduced_deductible_cents int,
  reduced_deductible_condition text,
  coverage_type text,
  notes text
);
alter table warranty enable row level security;
create policy own_child on warranty for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ ONE-OFF TASKS ============

create table task (
  id uuid primary key default gen_random_uuid(),
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  title text not null,
  detail text not null,
  why_urgent text,
  group_label text,
  due_date date,
  due_miles int,
  severity text not null default 'normal',
  external_url text,
  completed_at timestamptz,
  sort_order int not null default 0
);
create index on task (vehicle_id, sort_order);
alter table task enable row level security;
create policy own_child on task for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ SYMPTOMS ============

create table symptom_ref (
  id uuid primary key default gen_random_uuid(),
  template_set text not null,
  symptom text not null,
  aliases text[],
  first_check text not null,
  likely_cause text not null,
  watch_template_id uuid references watch_template(id),
  urgency text not null default 'normal'
);
alter table symptom_ref enable row level security;
create policy read_templates on symptom_ref for select
  using (auth.role() = 'authenticated');

-- ============ NOTIFICATIONS ============

create table notification_preference (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) default auth.uid(),
  channel text not null default 'none',
  channel_config jsonb default '{}'::jsonb,
  digest_day int,
  quiet_until date
);
alter table notification_preference enable row level security;
create policy own_pref on notification_preference for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create table notification_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  vehicle_id uuid not null references vehicle(id) on delete cascade,
  trigger_type text not null,
  trigger_ref_id uuid,
  subject text not null,
  body text not null,
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  channel text,
  error text
);
create index on notification_outbox (vehicle_id, scheduled_for desc);
alter table notification_outbox enable row level security;
create policy own_child on notification_outbox for all
  using (vehicle_id in (select id from vehicle where owner_id = auth.uid()))
  with check (vehicle_id in (select id from vehicle where owner_id = auth.uid()));

-- ============ APP STATE ============

-- ============ GRANTS ============
-- RLS decides which rows a user may touch. Grants decide whether the role may touch the
-- table at all, and without them every policy above evaluates to a permission error.

grant usage on schema public to authenticated;

grant select on maintenance_template, watch_template, symptom_ref to authenticated;

grant select, insert, update, delete on
  vehicle, odometer_reading, maintenance_item, service_log, watch_item,
  warranty, task, notification_preference, notification_outbox
  to authenticated;

create table app_state (
  user_id uuid primary key references auth.users(id) default auth.uid(),
  onboarding_completed_at timestamptz,
  onboarding_last_card int not null default 0,
  has_seen_intro_animation boolean not null default false
);
alter table app_state enable row level security;
create policy own_state on app_state for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update, delete on app_state to authenticated;
