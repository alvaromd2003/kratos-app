-- 3 additions: tips, a stamp-based loyalty program, and the data needed
-- for an estimated kitchen wait time.
--
-- amount_cents on payment_shares keeps meaning exactly what it always
-- has (the bill amount being settled — what getTableBillSummary uses to
-- compute the table's shared remaining balance). Tip and loyalty
-- discount must NOT change that number, or they'd throw off what other
-- diners at the table still owe. They're tracked separately:
--   tip_cents              — added on top, never reduces the balance.
--   loyalty_discount_cents — knocked off what's actually charged, but
--                            the bill is still considered fully settled
--                            for amount_cents (the restaurant absorbs
--                            the discount, same as any loyalty program).
--   charged_cents           — what actually moves: amount_cents -
--                            loyalty_discount_cents + tip_cents.
alter table payment_shares
  add column tip_cents int not null default 0,
  add column loyalty_discount_cents int not null default 0,
  add column charged_cents int not null default 0;

-- Lets us compute a real average prep time instead of just a queue
-- position count.
alter table orders add column ready_at timestamptz;

-- A diner can optionally leave an email to accumulate stamps at this
-- restaurant across visits — entirely opt-in, no account/login needed.
alter table session_participants
  add column loyalty_email text,
  add column loyalty_stamp_awarded boolean not null default false;

create table loyalty_accounts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  email text not null,
  stamps int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (restaurant_id, email)
);

-- No RLS policies on purpose: only ever touched server-side via the
-- service-role client (page.tsx, the Stripe webhook, confirmCashPayment)
-- — never queried from the browser, so this locks it to service-role
-- access only.
alter table loyalty_accounts enable row level security;
