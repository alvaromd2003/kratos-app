-- Phase 2: table sessions, participants, and a shared live cart.
-- Submitting the cart to the kitchen is Phase 3 — for now this is just an
-- open session everyone at the table can see and add to together.

create table table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_id uuid not null references tables (id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table session_participants (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references table_sessions (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table order_items (
  id uuid primary key default gen_random_uuid(),
  table_session_id uuid not null references table_sessions (id) on delete cascade,
  menu_item_id uuid not null references menu_items (id),
  participant_id uuid not null references session_participants (id) on delete cascade,
  quantity int not null default 1 check (quantity > 0),
  note text,
  created_at timestamptz not null default now()
);

-- Unique (not just an index): guarantees two diners scanning at the same
-- moment can't each create their own open session for the same table.
create unique index table_sessions_open_by_table on table_sessions (table_id) where status = 'open';
create index session_participants_by_session on session_participants (table_session_id);
create index order_items_by_session on order_items (table_session_id);

alter table table_sessions enable row level security;
alter table session_participants enable row level security;
alter table order_items enable row level security;

-- Staff: full read access for their restaurant (kitchen/admin dashboards
-- will build on this in Phase 3).
create policy "staff can view table sessions" on table_sessions
  for select using (is_restaurant_staff(restaurant_id));

create policy "staff can view session participants" on session_participants
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = session_participants.table_session_id
        and is_restaurant_staff(ts.restaurant_id)
    )
  );

create policy "staff can view order items" on order_items
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = order_items.table_session_id
        and is_restaurant_staff(ts.restaurant_id)
    )
  );

-- Diners: all writes go through Server Actions using the service-role
-- client (which independently checks the diner's cookie before touching
-- anything — see src/app/actions/ordering.ts). These read-only policies,
-- scoped to sessions that are still open, exist only so the browser can
-- hold a Realtime subscription (anon key) and see live updates from other
-- diners at the same table without polling.
create policy "anyone can view an open table session" on table_sessions
  for select using (status = 'open');

create policy "anyone can view participants of an open session" on session_participants
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = session_participants.table_session_id and ts.status = 'open'
    )
  );

create policy "anyone can view order items of an open session" on order_items
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = order_items.table_session_id and ts.status = 'open'
    )
  );

-- Required for the browser to receive live updates via Supabase Realtime
-- (the shared cart) — without this, postgres_changes never fires even
-- though the RLS policies above allow the SELECT.
alter publication supabase_realtime add table session_participants;
alter publication supabase_realtime add table order_items;
