-- "Llamar al camarero": a diner can flag their table for help without a
-- waiter walking by. Writes go through the service-role client (same
-- pattern as the rest of ordering.ts), so no anon insert policy needed.
create table help_requests (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_session_id uuid not null references table_sessions (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index help_requests_open_by_restaurant on help_requests (restaurant_id) where status = 'open';

alter table help_requests enable row level security;

create policy "staff can view help requests" on help_requests
  for select using (is_restaurant_staff(restaurant_id));

create policy "staff can resolve help requests" on help_requests
  for update using (is_restaurant_staff(restaurant_id));

alter publication supabase_realtime add table help_requests;

-- Allergen/dietary filters on the menu.
alter table menu_items add column dietary_tags text[] not null default '{}';
