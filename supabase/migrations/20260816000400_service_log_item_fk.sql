-- A service log pointed at a schedule item that was being deleted blocked the delete
-- outright. The record of the work matters more than the link to the schedule row, so
-- the link is cleared instead.

set search_path = maintenance, public;

alter table service_log drop constraint service_log_maintenance_item_id_fkey;
alter table service_log add constraint service_log_maintenance_item_id_fkey
  foreign key (maintenance_item_id) references maintenance_item(id) on delete set null;
