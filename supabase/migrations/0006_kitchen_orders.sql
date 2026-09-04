-- Phase 3: sending the shared cart to the kitchen as a discrete order, and
-- a live kitchen screen for staff to track it.
--
-- order_items with order_id = null are still "in the cart" (being built by
-- diners); sending the order stamps all of them with a new orders row and
-- the cart starts fresh for a possible next round (dessert, more drinks…).

create type order_status as enum ('pending', 'preparing', 'ready', 'delivered');

create table orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_session_id uuid not null references table_sessions (id) on delete cascade,
  status order_status not null default 'pending',
  created_at timestamptz not null default now()
);

alter table order_items add column order_id uuid references orders (id) on delete set null;

create index orders_by_restaurant on orders (restaurant_id, status);
create index order_items_by_order on order_items (order_id);

alter table orders enable row level security;

create policy "staff can view orders" on orders
  for select using (is_restaurant_staff(restaurant_id));

create policy "kitchen staff can update order status" on orders
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'kitchen_staff']::restaurant_role[])
  );

-- Diners can see their own table's orders too (so the app could later show
-- "pedido enviado" status), scoped the same way as the rest of Phase 2.
create policy "anyone can view orders of an open session" on orders
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = orders.table_session_id and ts.status = 'open'
    )
  );

alter publication supabase_realtime add table orders;
