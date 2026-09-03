-- Phase 1: tenancy, restaurant staff, menu, and tables.
-- Phase 2 will add table_sessions / session_participants / orders / order_items.
-- Phase 4 will add payments / payment_shares.

create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  currency text not null default 'EUR',
  stripe_account_id text,
  stripe_onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create type restaurant_role as enum ('owner', 'admin', 'kitchen_staff');

create table restaurant_users (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role restaurant_role not null default 'owner',
  created_at timestamptz not null default now(),
  unique (restaurant_id, user_id)
);

create table menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  category_id uuid references menu_categories (id) on delete set null,
  name text not null,
  description text,
  price_cents int not null check (price_cents >= 0),
  image_url text,
  is_available boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  label text not null,
  qr_token uuid not null default gen_random_uuid() unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Helper used by every policy below: does the current user belong to this
-- restaurant, and (optionally) do they hold one of the given roles?
create function is_restaurant_staff(target_restaurant_id uuid, allowed_roles restaurant_role[] default null)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from restaurant_users ru
    where ru.restaurant_id = target_restaurant_id
      and ru.user_id = auth.uid()
      and (allowed_roles is null or ru.role = any (allowed_roles))
  );
$$;

alter table restaurants enable row level security;
alter table restaurant_users enable row level security;
alter table menu_categories enable row level security;
alter table menu_items enable row level security;
alter table tables enable row level security;

-- restaurants: any staff member can view; only owner/admin can edit.
create policy "staff can view their restaurant" on restaurants
  for select using (is_restaurant_staff(id));

create policy "owner/admin can update their restaurant" on restaurants
  for update using (is_restaurant_staff(id, array['owner', 'admin']::restaurant_role[]));

-- restaurant_users: staff can see co-workers at the same restaurant.
create policy "staff can view co-workers" on restaurant_users
  for select using (is_restaurant_staff(restaurant_id));

-- menu_categories / menu_items / tables: staff can view; owner/admin can manage.
create policy "staff can view menu categories" on menu_categories
  for select using (is_restaurant_staff(restaurant_id));
create policy "owner/admin can manage menu categories" on menu_categories
  for all using (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]))
  with check (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]));

create policy "staff can view menu items" on menu_items
  for select using (is_restaurant_staff(restaurant_id));
create policy "owner/admin can manage menu items" on menu_items
  for all using (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]))
  with check (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]));

create policy "staff can view tables" on tables
  for select using (is_restaurant_staff(restaurant_id));
create policy "owner/admin can manage tables" on tables
  for all using (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]))
  with check (is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[]));
