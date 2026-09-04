-- The MaxCare 75,000 mile cap is ambiguous until CarMax confirms whether it counts
-- total odometer miles or miles driven since purchase. warranty.cap_is_total_odometer
-- already holds the answer once known (null until then), and starts_from_odometer
-- already holds the reference odometer for a since purchase reading. Neither column
-- records when the answer was recorded, so the app has no way to show that the
-- ambiguity was actually resolved rather than defaulted.

set search_path = maintenance, public;

alter table warranty add column if not exists cap_basis_recorded_at date;
