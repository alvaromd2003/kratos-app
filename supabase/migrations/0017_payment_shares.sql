-- Phase 4: Stripe payments. A diner pays through one of 3 modes
-- (individual/split/collective) — each one just computes a different
-- amount to charge; every successful row here reduces how much is left
-- to pay for the whole table_session, regardless of which mode paid it.
--
-- All writes go through the service-role client: the payment actions
-- (src/app/actions/payments.ts) insert the 'pending' row before creating
-- the Stripe Checkout Session, and the webhook (src/app/api/webhooks/stripe)
-- flips it to 'succeeded' once Stripe confirms the charge. Nothing here is
-- ever written directly from the browser.

create table payment_shares (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_session_id uuid not null references table_sessions (id) on delete cascade,
  participant_id uuid not null references session_participants (id) on delete cascade,
  mode text not null check (mode in ('individual', 'split', 'collective')),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending' check (status in ('pending', 'succeeded', 'failed')),
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index payment_shares_by_session on payment_shares (table_session_id);

alter table payment_shares enable row level security;

create policy "staff can view payment shares" on payment_shares
  for select using (is_restaurant_staff(restaurant_id));

-- Same reasoning as order_items/orders: read-only, scoped to still-open
-- sessions, just so the browser can hold a Realtime subscription and see
-- other diners' payments land live.
create policy "anyone can view payment shares of an open session" on payment_shares
  for select using (
    exists (
      select 1 from table_sessions ts
      where ts.id = payment_shares.table_session_id and ts.status = 'open'
    )
  );

alter publication supabase_realtime add table payment_shares;
