set search_path = maintenance, public;

-- Maintenance: template seed data.
--
-- Every interval, dollar figure, mileage window, and causal claim below comes from the
-- ownership guide written for this car. Where the guide is silent, the column stays null
-- and the UI renders without it. Do not add figures that are not in the guide.

-- ============================================================
-- maintenance_template, set 'universal'
-- ============================================================

insert into maintenance_template
  (template_set, name, category, interval_miles, interval_months,
   plain_language, why_it_matters, note,
   typical_cost_low_cents, typical_cost_high_cents,
   prevents_label, prevents_cost_low_cents, prevents_cost_high_cents, sort_order)
values
('universal', 'Oil and filter change', 'fluids', 5000, 6,
 $t$Fresh oil and a new filter. The single most important thing you do to this car.$t$,
 $t$Two turbochargers spin at very high speed on this oil, and they are the first thing to fail when it gets old.$t$,
 $t$The manual allows 7,500 miles, but stop and go traffic, heat, and hills all qualify as severe service under the manual's own definition, and this engine has two turbochargers running on that oil.$t$,
 null, null, null, null, null, 10),

('universal', 'Tire rotation', 'tires', 5000, null,
 $t$Moving each tire to a different corner so they wear evenly.$t$,
 $t$Tires wear at different rates front to rear. Rotating them keeps all four usable to the same mileage instead of replacing two early.$t$,
 $t$Easiest to do at the same visit as the oil change, since the car is already on a lift.$t$,
 null, null, null, null, null, 20),

('universal', 'Engine air filter', 'filters', 10000, null,
 $t$The filter that cleans the air going into the engine.$t$,
 $t$A clogged filter restricts airflow, which the turbochargers have to work against.$t$,
 null, null, null, null, null, null, 30),

('universal', 'Cabin air filter', 'filters', 10000, 12,
 $t$The filter that cleans the air coming out of your vents.$t$,
 $t$This one is about the air you breathe and how well the climate control moves air, not about the engine.$t$,
 null, null, null, null, null, null, 40),

('universal', 'Brake pad and rotor inspection', 'brakes', 10000, null,
 $t$A look at how much brake material is left and whether the discs are still flat.$t$,
 $t$Pads worn past their material start cutting into the rotors, which turns a pad replacement into a pad and rotor replacement.$t$,
 null, null, null, null, null, null, 50),

('universal', 'Suspension and steering inspection', 'inspection', 10000, null,
 $t$A check of the parts that hold the wheels on and point them where you steer.$t$,
 $t$Worn suspension parts announce themselves as noise long before they fail, so a regular look catches them while they are still cheap.$t$,
 null, null, null, null, null, null, 60),

('universal', 'Brake fluid flush', 'fluids', null, 24,
 $t$Replacing the fluid that carries your foot's pressure to the brakes.$t$,
 $t$Brake fluid absorbs water out of the air over time, and water in the line boils under hard braking, which is when the pedal goes soft.$t$,
 null, null, null, null, null, null, 70),

('universal', 'Wiper blades', 'inspection', null, 6,
 $t$New rubber on the wipers.$t$,
 $t$Worn blades chatter and smear, and the stiff edge of an old blade can scratch the glass.$t$,
 null, null, null, null, null, null, 80),

('universal', 'A/C performance check', 'inspection', null, 12,
 $t$A measurement of how cold the air conditioning actually gets.$t$,
 $t$Air conditioning fades slowly enough that you stop noticing. Measuring it catches a leak while it is still a leak.$t$,
 null, null, null, null, null, null, 90),

('universal', 'Four wheel alignment', 'inspection', null, 12,
 $t$Setting the angle of all four wheels so they point straight.$t$,
 $t$Out of alignment, the car scrubs its tires sideways down the road, and you buy tires early.$t$,
 $t$Wear on the inside edge of the rear tires is the red flag to watch for.$t$,
 null, null, null, null, null, 100),

('universal', '12V battery load test', 'electrical', null, 12,
 $t$A test of whether the battery can still deliver current under load, not just show a voltage.$t$,
 $t$A battery can read fine at rest and still fail to start the car cold. The load test is what tells you it is on the way out.$t$,
 $t$The cost range here is for an AGM replacement, not for the test itself.$t$,
 15000, 25000, null, null, null, 110),

('universal', 'Leather conditioning', 'interior', null, 4,
 $t$Cleaning and conditioning the leather seats.$t$,
 $t$Leather that dries out cracks, and cracked seats are not repairable, only replaceable.$t$,
 null, null, null, null, null, null, 120);

-- ============================================================
-- maintenance_template, set 'g70_33t'
-- ============================================================

insert into maintenance_template
  (template_set, name, category, interval_miles, interval_months,
   plain_language, why_it_matters, note,
   typical_cost_low_cents, typical_cost_high_cents,
   prevents_label, prevents_cost_low_cents, prevents_cost_high_cents, sort_order)
values
('g70_33t', 'Transmission fluid service', 'fluids', 35000, null,
 $t$Draining and replacing the fluid inside the automatic transmission.$t$,
 $t$Shudder and low speed hesitation on this 8 speed are almost always a fluid problem rather than a mechanical one.$t$,
 $t$This is the fluid cost plus roughly one hour of labor.$t$,
 4000, 8000, null, null, null, 200),

('g70_33t', 'Rear differential fluid', 'fluids', 50000, null,
 $t$Replacing the gear oil in the rear axle, which is what actually turns the rear wheels.$t$,
 $t$Coupling failures on this drivetrain are usually traceable to differential fluid that was never serviced.$t$,
 null, null, null,
 'HTRAC coupling unit failure', 60000, 120000, 210),

('g70_33t', 'Transfer case fluid', 'fluids', 50000, null,
 $t$Replacing the fluid in the unit that splits power between the front and rear wheels.$t$,
 $t$Coupling failures on this drivetrain are usually traceable to fluid that was never serviced.$t$,
 null, null, null,
 'HTRAC coupling unit failure', 60000, 120000, 220),

('g70_33t', 'Coolant flush', 'fluids', 60000, 60,
 $t$Replacing the coolant that carries heat away from the engine.$t$,
 $t$Coolant loses its corrosion protection with age, and a twin turbo engine has a lot of hot metal depending on it.$t$,
 null, null, null, null, null, null, 230),

('g70_33t', 'Valve clearance inspection', 'inspection', 60000, null,
 $t$Measuring the small gap at each valve and adjusting it if it has drifted.$t$,
 $t$Clearances move slowly over tens of thousands of miles, and out of spec valves run rough and wear unevenly.$t$,
 null, null, null, null, null, null, 240),

('g70_33t', 'Spark plugs', 'inspection', 45000, null,
 $t$New plugs, which are what actually light the fuel in each cylinder.$t$,
 $t$Worn plugs make the ignition system work harder and show up as misfires under boost.$t$,
 $t$The interval lands right at your purchase mileage, so verify whether these were already done.$t$,
 null, null, null, null, null, 250);

-- ============================================================
-- watch_template, set 'g70_33t'
-- ============================================================

insert into watch_template
  (template_set, name, window_start_miles, window_end_miles,
   est_cost_low_cents, est_cost_high_cents, coverage_guess, coverage_note,
   symptoms, first_check, plain_language, severity)
values
('g70_33t', 'Rear suspension clunk', 30000, 60000, null, null, 'likely_covered', null,
 $t$A clunk or knock from the rear when you go over bumps or expansion joints.$t$,
 $t$Have the shop check rear subframe bolt torque before buying any parts. Loose bolts are a documented cause and cost nothing to fix. Only if the bolts are tight do you look at sway bar end links ($20 to $60 per side), trailing arm bushings ($50 to $150 per side), or rear shock mounts ($80 to $200 per side).$t$,
 $t$The most common complaint on this car, and the one most often fixed by tightening bolts rather than replacing parts.$t$,
 'normal'),

('g70_33t', 'Transmission shudder at 40-55 mph', 40000, 70000, null, null, 'likely_covered', null,
 $t$A shudder or hesitation at light throttle between about 40 and 55 mph.$t$,
 $t$Get the transmission fluid serviced before anyone opens the transmission.$t$,
 $t$This feels like something serious and almost always is not. On this 8 speed it points at the fluid rather than at broken hardware.$t$,
 'normal'),

('g70_33t', '12V battery failure', 42000, 60000, 15000, 25000, 'not_covered', null,
 $t$Slow cranking, a jump start needed after sitting, or electronics behaving strangely.$t$,
 $t$Have the battery load tested rather than voltage checked.$t$,
 $t$Batteries are a wear item, so this one comes out of your pocket regardless of coverage.$t$,
 'normal'),

('g70_33t', 'Brake rotor warping', 40000, 70000, null, null, 'not_covered', null,
 $t$A pulse through the steering wheel or the brake pedal when you slow from speed.$t$,
 $t$Have the rotors measured for thickness variation before replacing anything.$t$,
 $t$Brakes are wear items, so this is yours to pay for whatever the warranty covers elsewhere.$t$,
 'normal'),

('g70_33t', 'Carbon buildup on intake valves', 60000, 80000, 50000, 90000, 'gray',
 $t$The engine is a covered system in principle, but carbon accumulation on a direct injection engine is an inherent design characteristic rather than a failed part, and administrators sometimes push back on that basis. Budget $500 to $900 as if paying it.$t$,
 $t$Rough idle, a stumble on cold start, and power that has faded so gradually you did not notice.$t$,
 $t$Ask for the intake valves to be inspected with a borescope before agreeing to any cleaning work.$t$,
 $t$On a direct injection engine, fuel no longer washes over the intake valves, so deposits build up there and need cleaning off, usually by walnut blasting, which is how carbon deposits get removed without pulling the engine apart.$t$,
 'normal'),

('g70_33t', 'Front strut wear', 60000, 80000, 20000, 40000, 'likely_covered', null,
 $t$A floaty or bouncy ride, and a knock from the front over bumps.$t$,
 $t$Have both front struts inspected for leaking fluid at the same visit.$t$,
 $t$Struts are what keep each front wheel pressed to the road. The cost range is per strut, and they are replaced in pairs.$t$,
 'normal'),

('g70_33t', 'Turbocharger oil feed lines', 70000, 100000, 8000, 20000, 'likely_covered', null,
 $t$An oil smell in the engine bay, or oil residue around the turbochargers.$t$,
 $t$Have the lines inspected for seepage at your next oil change once you are in this window.$t$,
 $t$These are the small pipes that carry oil to the turbochargers. This is the same general area as recall 24V-191, which is why getting that recall done matters twice over. The cost range is parts, plus 2 to 4 hours of labor.$t$,
 'normal'),

('g70_33t', 'Oil cooler line seep', 70000, 100000, 15000, 40000, 'likely_covered', null,
 $t$Oil spots where you park, or an oil level that drops with no smoke from the exhaust.$t$,
 $t$Have the oil cooler lines inspected during a routine oil change.$t$,
 $t$The lines that carry oil to and from the cooler start weeping at the seals rather than failing outright. The cost range is parts, plus 1 to 3 hours of labor.$t$,
 'normal'),

('g70_33t', 'AWD coupling unit', 70000, 100000, 60000, 120000, 'likely_covered', null,
 $t$An AWD warning light, or the car binding and shuddering in tight low speed turns.$t$,
 $t$Confirm the rear differential and transfer case fluid have both been serviced, since neglected fluid is the usual cause.$t$,
 $t$This is the unit that decides how much power goes to the front wheels. The cost range is parts. Keeping the differential and transfer case fluid serviced is what prevents it.$t$,
 'normal');

-- ============================================================
-- symptom_ref, set 'g70_33t'
-- Each row traces to a watch template or a documented task above.
-- ============================================================

insert into symptom_ref (template_set, symptom, aliases, first_check, likely_cause, watch_template_id, urgency)
values
('g70_33t', 'Sudden loss of power while driving',
 array['car died','lost power','engine cut out','stalled while driving','shut off on the highway'],
 $t$Stop driving and have it towed. Book the fuel pump recall, Genesis 262/023G, which the dealer performs free.$t$,
 $t$An open recall covers a fuel pump that can fail and cause a loss of drive power.$t$,
 null, 'stop_driving'),

('g70_33t', 'Oil smell in the engine bay',
 array['smells like oil','burning oil smell','hot oil smell','smell under the hood'],
 $t$Book recall 24V-191 if it is still open. The oil supply pipe it replaces can crack and leak onto hot components.$t$,
 $t$A cracked turbocharger oil supply pipe or a seeping oil feed line.$t$,
 (select id from watch_template where name = 'Turbocharger oil feed lines'), 'soon'),

('g70_33t', 'AWD light on with binding in turns',
 array['awd light','4wd light','binding in turns','shudders in parking lot','tight turn judder'],
 $t$Confirm the rear differential and transfer case fluid have been serviced.$t$,
 $t$The AWD coupling unit, usually traceable to differential fluid that was never changed.$t$,
 (select id from watch_template where name = 'AWD coupling unit'), 'soon'),

('g70_33t', 'Clunk from the rear over bumps',
 array['clunking noise','knocking over bumps','rattle from the back','thud over potholes'],
 $t$Have the shop check rear subframe bolt torque before buying any parts.$t$,
 $t$Loose rear subframe bolts, which cost nothing to tighten. End links, bushings, and shock mounts come after that.$t$,
 (select id from watch_template where name = 'Rear suspension clunk'), 'normal'),

('g70_33t', 'Shudder or hesitation at 40 to 55 mph',
 array['shaking at highway speed','vibration when cruising','hesitates when accelerating','judder'],
 $t$Get the transmission fluid serviced before anyone opens the transmission.$t$,
 $t$Worn transmission fluid. On this 8 speed it is almost always the fluid rather than a mechanical fault.$t$,
 (select id from watch_template where name = 'Transmission shudder at 40-55 mph'), 'normal'),

('g70_33t', 'Slow cranking or a dead battery',
 array['wont start','slow to start','needed a jump','clicking when I turn the key','electronics acting weird'],
 $t$Have the battery load tested rather than voltage checked.$t$,
 $t$The 12V battery reaching the end of its life.$t$,
 (select id from watch_template where name = '12V battery failure'), 'normal'),

('g70_33t', 'Pulsing through the pedal or wheel when braking',
 array['brakes shake','steering wheel shakes when I brake','vibration when stopping','wobble when braking'],
 $t$Have the rotors measured for thickness variation before replacing anything.$t$,
 $t$Warped or unevenly worn brake rotors.$t$,
 (select id from watch_template where name = 'Brake rotor warping'), 'normal'),

('g70_33t', 'Rough idle or a stumble on cold start',
 array['shakes at a stoplight','runs rough','stumbles when cold','feels down on power'],
 $t$Ask for the intake valves to be inspected with a borescope before agreeing to any cleaning work.$t$,
 $t$Carbon deposits on the intake valves, which is inherent to a direct injection engine.$t$,
 (select id from watch_template where name = 'Carbon buildup on intake valves'), 'normal'),

('g70_33t', 'Floaty ride or a knock from the front',
 array['bouncy ride','front end noise','clunk from the front','car feels loose over bumps'],
 $t$Have both front struts inspected for leaking fluid.$t$,
 $t$Worn front struts.$t$,
 (select id from watch_template where name = 'Front strut wear'), 'normal'),

('g70_33t', 'Oil spots under the car or a dropping oil level',
 array['leaking oil','oil on the driveway','losing oil','oil level keeps dropping'],
 $t$Have the oil cooler lines inspected at your next oil change.$t$,
 $t$Seeping oil cooler lines, which weep at the seals rather than failing outright.$t$,
 (select id from watch_template where name = 'Oil cooler line seep'), 'normal'),

('g70_33t', 'Wear on the inside edge of the rear tires',
 array['tires wearing unevenly','bald on one side','inside edge worn','tire wear'],
 $t$Get a four wheel alignment and have the rear suspension inspected at the same visit.$t$,
 $t$Alignment that has drifted out of spec. This is the red flag a new owner is told to look for.$t$,
 null, 'normal'),

('g70_33t', 'Check engine light on',
 array['engine light','warning light on the dash','cel','orange engine symbol'],
 $t$Get an OBD-II scan that includes pending codes and fuel trims. Trims should sit within plus or minus 5 percent at idle and cruise.$t$,
 $t$Too many causes to guess at. The scan is what turns the light into an answer.$t$,
 null, 'normal');
