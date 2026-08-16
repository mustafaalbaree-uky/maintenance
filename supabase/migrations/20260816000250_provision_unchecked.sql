-- Turns a newly created vehicle into a full working plan: schedule items copied from
-- templates, watch items copied from templates, the one-off task lists, and the two
-- warranty rows. Runs as the caller, so RLS still applies.

set search_path = maintenance, public;

create or replace function maintenance.provision_vehicle_unchecked(p_vehicle_id uuid, p_template_set text default 'g70_33t')
returns void
language plpgsql
-- Pinned so the function resolves its tables the same way however PostgREST calls it.
set search_path = maintenance, public
as $fn$
declare
  v vehicle%rowtype;
begin
  select * into v from vehicle where id = p_vehicle_id;
  if not found then
    raise exception 'vehicle not found';
  end if;

  -- Schedule items. No service history exists, so every item anchors at purchase.
  insert into maintenance_item (
    vehicle_id, template_id, name, category, interval_miles, interval_months,
    plain_language, why_it_matters, note,
    typical_cost_low_cents, typical_cost_high_cents,
    prevents_label, prevents_cost_low_cents, prevents_cost_high_cents,
    anchor_odometer, anchor_date, sort_order)
  select
    v.id, t.id, t.name, t.category, t.interval_miles, t.interval_months,
    t.plain_language, t.why_it_matters, t.note,
    t.typical_cost_low_cents, t.typical_cost_high_cents,
    t.prevents_label, t.prevents_cost_low_cents, t.prevents_cost_high_cents,
    v.purchase_odometer, v.purchase_date, t.sort_order
  from maintenance_template t
  where t.template_set in ('universal', p_template_set);

  -- Known failure points.
  insert into watch_item (
    vehicle_id, watch_template_id, name, window_start_miles, window_end_miles,
    est_cost_low_cents, est_cost_high_cents, coverage_guess, coverage_note,
    symptoms, first_check, plain_language, severity)
  select
    v.id, w.id, w.name, w.window_start_miles, w.window_end_miles,
    w.est_cost_low_cents, w.est_cost_high_cents, w.coverage_guess, w.coverage_note,
    w.symptoms, w.first_check, w.plain_language, w.severity
  from watch_template w
  where w.template_set = p_template_set;

  -- ============ Warranty ============

  insert into warranty (vehicle_id, name, ends_at_miles, cap_is_total_odometer,
    deductible_cents, reduced_deductible_cents, reduced_deductible_condition,
    coverage_type, notes)
  values (v.id, 'MaxCare', 75000, null, 40000, 35000,
    'CarMax Service Center or RepairPal Certified shop',
    'exclusionary',
    $t$Covered: engine, transmission, drivetrain, electrical, electronics, steering, suspension, cooling, and climate control. Named examples include turbocharger failure, transmission internals or torque converter, the HTRAC coupling, water pump, thermostat, AC compressor, infotainment head unit, blind spot sensor module, the fuel pump if it is not covered by the recall, and suspension components that fail rather than wear.

Not covered: all routine maintenance including oil, filters, fluids, brakes, batteries, and wipers. Tires, wheels, and dents need MaxCare Plus. Abuse or misuse. Aftermarket parts fitted after purchase.

Every receipt must show the VIN, the date, the odometer, and exactly what was performed.$t$);

  insert into warranty (vehicle_id, name, ends_at_miles, ends_at_date,
    cap_is_total_odometer, coverage_type, notes)
  values (v.id, 'Factory New Vehicle Limited Warranty', 60000,
    case when v.in_service_date is not null then v.in_service_date + interval '5 years' else null end::date,
    true, 'limited',
    $t$As a second owner you do not get the 10 year or 100,000 mile powertrain warranty. You get powertrain coverage under the 5 year or 60,000 mile New Vehicle Limited Warranty, measured from the original in service date. At 42,000 of a 60,000 mile cap, any remaining window is free coverage that sits ahead of MaxCare.

The end date stays blank until a Genesis dealer gives you the original in service date.$t$);

  -- ============ Tasks: first week ============

  insert into task (vehicle_id, title, detail, why_urgent, group_label, severity, external_url, sort_order)
  values
  (v.id, 'Run your VIN at nhtsa.gov/recalls',
   $t$Enter your VIN on the NHTSA site to see every open recall on this specific car, not just the two listed here. A recall means the manufacturer found a defect and fixes it free, at any dealer, with no time limit.$t$,
   $t$It takes a minute and it is the only way to know the list is complete.$t$,
   'First week', 'critical', 'https://www.nhtsa.gov/recalls', 10),

  (v.id, 'Book recall 24V-191, left turbocharger oil supply pipe',
   $t$Recall 24V-191, which Genesis calls 019G, affects 2019 to 2022 G70 cars with the 3.3L turbo V6. The pipe can crack and leak oil onto hot components, which is an engine bay fire risk. The repair is free at any Genesis dealer. It supersedes recall 19V-538, so it applies even if the earlier fix was already performed.$t$,
   $t$This is a fire risk and it costs nothing to fix.$t$,
   'First week', 'critical', null, 20),

  (v.id, 'Book recall 262/023G, fuel pump',
   $t$The fuel pump recall, Genesis 262/023G, affects 2019 to 2023 G70 cars. The pump can fail and cause a loss of drive power. The dealer updates the ECM software and inspects or replaces the pump as needed. Free.$t$,
   $t$A pump failure means losing power while driving.$t$,
   'First week', 'high', null, 30),

  (v.id, 'Ask CarMax whether the 75,000 mile cap is total odometer',
   $t$Ask CarMax, in writing if you can get it, whether the MaxCare 75,000 mile limit counts total odometer miles or miles driven from your purchase. Then record the answer in the app.$t$,
   $t$The answer decides whether you are covered through the years this car is most likely to need it.$t$,
   'First week', 'critical', null, 40),

  (v.id, 'Call a Genesis dealer for the original in-service date',
   $t$Give any Genesis dealer your VIN and ask for the original in service date. That date is what the factory 5 year or 60,000 mile warranty is measured from.$t$,
   $t$Until you have it you cannot tell how much free factory coverage is still left ahead of MaxCare.$t$,
   'First week', 'high', null, 50),

  (v.id, 'Find the nearest RepairPal Certified shop',
   $t$Using a RepairPal Certified shop or a CarMax Service Center drops the MaxCare deductible by $50, from $400 to $350. Find the closest one now, before you need it.$t$,
   null,
   'First week', 'normal', 'https://repairpal.com/certified-shops', 60),

  (v.id, 'Set up a receipts folder, physical and digital',
   $t$One folder in the glovebox and one on your phone. Every receipt needs the VIN, the date, the odometer, and what was done.$t$,
   $t$Missing records is the most common reason warranty claims get denied.$t$,
   'First week', 'normal', null, 70);

  -- ============ Tasks: first month baseline ============
  -- The point of this list is to reset service history to a known state, whatever the
  -- dealer says was already done, so MaxCare claims later have something to stand on.

  insert into task (vehicle_id, title, detail, why_urgent, group_label, severity, sort_order)
  values
  (v.id, 'Full synthetic 5W-30 oil and filter change',
   $t$Ask for full synthetic 5W-30, and ask the shop to inspect the drain plug for metal debris while it is out.$t$,
   $t$You have no record of when this was last done, and metal on the plug is the earliest warning you can get.$t$,
   'First month baseline', 'high', 110),

  (v.id, 'OBD-II scan including pending codes and fuel trims',
   $t$Ask for a scan that includes pending codes, not just active ones, and fuel trim readings. Trims should sit within plus or minus 5 percent at idle and at cruise.$t$,
   $t$Pending codes are problems the car has noticed but not yet turned into a warning light.$t$,
   'First month baseline', 'high', 120),

  (v.id, 'Transmission fluid service',
   $t$Ask for SP-IV spec fluid or an equivalent.$t$,
   $t$Shudder and low speed hesitation on this transmission are almost always fluid, so starting from fresh fluid removes the most likely fault before it appears.$t$,
   'First month baseline', 'normal', 130),

  (v.id, 'Rear differential and transfer case fluid',
   $t$Both units, at the same visit.$t$,
   $t$Coupling failures are usually traceable to fluid that was never serviced, and a coupling unit runs $600 to $1,200 in parts.$t$,
   'First month baseline', 'normal', 140),

  (v.id, 'Brake fluid flush if there is no record within two years',
   $t$If nobody can show you a brake fluid service in the last two years, have it flushed.$t$,
   null,
   'First month baseline', 'normal', 150),

  (v.id, 'Coolant condition check',
   $t$A check of the coolant condition, not necessarily a flush.$t$,
   null,
   'First month baseline', 'normal', 160),

  (v.id, 'Engine and cabin air filters',
   $t$Replace both. They are cheap and you have no record of either.$t$,
   null,
   'First month baseline', 'normal', 170),

  (v.id, 'Tire tread depth on all four',
   $t$Measure all four, and specifically check the inside edge of the rear tires.$t$,
   $t$Wear on the inside rear edge is an alignment red flag.$t$,
   'First month baseline', 'normal', 180),

  (v.id, 'Four wheel alignment',
   $t$A full four wheel alignment, done after the tire check so any wear pattern is already documented.$t$,
   null,
   'First month baseline', 'normal', 190),

  (v.id, '12V battery load test',
   $t$A load test, not a voltage reading.$t$,
   $t$At your mileage the original battery is inside the window where these start failing.$t$,
   'First month baseline', 'normal', 200),

  (v.id, 'Verify whether the spark plugs were done',
   $t$The spark plug interval is 45,000 miles and you bought the car at 42,000, so ask whether they have already been replaced.$t$,
   $t$The interval lands almost exactly at your purchase, so this is either already done or about to be due.$t$,
   'First month baseline', 'normal', 210),

  (v.id, 'Photograph the car end to end',
   $t$Photograph the odometer, all four wheels, every panel, and the interior, and keep the photos with your receipts.$t$,
   $t$This is your record of the condition the car arrived in.$t$,
   'First month baseline', 'normal', 220);
end;
$fn$;


