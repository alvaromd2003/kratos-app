-- 4th payment mode: a diner picks exactly which order_items (anyone's at
-- the table, not just their own — covering a shared starter or someone
-- else's dessert) they want to settle, instead of a fixed
-- individual/split/collective amount.
alter table payment_shares drop constraint payment_shares_mode_check;
alter table payment_shares add constraint payment_shares_mode_check
  check (mode in ('individual', 'split', 'collective', 'cash', 'items'));

-- Which order_items a given payment_share covers. An item only counts as
-- "already claimed" once its payment_share succeeds (see
-- getClaimedOrderItemIds) — never while still pending — so an abandoned
-- Stripe Checkout doesn't lock an item out of being picked again.
create table payment_share_items (
  payment_share_id uuid not null references payment_shares (id) on delete cascade,
  order_item_id uuid not null references order_items (id) on delete cascade,
  primary key (payment_share_id, order_item_id)
);

-- No RLS policies on purpose: only ever touched server-side via the
-- service-role client, same reasoning as loyalty_accounts (migration 0020).
alter table payment_share_items enable row level security;
