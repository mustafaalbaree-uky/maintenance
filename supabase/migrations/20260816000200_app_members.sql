-- This project's auth pool is shared with the mailbox app, so every mailbox account is a
-- valid login here. Owning a row was the only requirement, which meant any of them could
-- walk in and create a car.
--
-- Membership is now explicit and enforced in the database, not in the interface.

set search_path = maintenance, public;

create table app_member (
  user_id uuid primary key references auth.users(id) on delete cascade,
  note text,
  added_at timestamptz default now()
);

alter table app_member enable row level security;

-- You may see your own membership, which is how the app knows to let you in.
create policy read_own on app_member for select using (user_id = auth.uid());

grant select on app_member to authenticated;

insert into app_member (user_id, note)
select id, 'owner' from auth.users where email = 'mohammadalbaree@gmail.com'
on conflict do nothing;

insert into app_member (user_id, note)
select id, 'tester' from auth.users where email = 'mammergaming55+maintenance@gmail.com'
on conflict do nothing;

-- Owning the row is no longer enough: you must also be a member. The child tables reach
-- their rows through this policy, so gating here gates all of them.
drop policy own_vehicle on vehicle;
create policy own_vehicle on vehicle for all
  using (
    owner_id = auth.uid()
    and exists (select 1 from app_member m where m.user_id = auth.uid())
  )
  with check (
    owner_id = auth.uid()
    and exists (select 1 from app_member m where m.user_id = auth.uid())
  );
