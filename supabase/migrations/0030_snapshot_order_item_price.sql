-- order_items had no price of its own — every bill calculation joined
-- live against menu_items.price_cents. Editing a price (fixing a typo,
-- ending a happy-hour rate) while a table's session was still open would
-- retroactively change what an already-fully-paid bill "owed", making a
-- settled table's payment panel reactivate. Snapshotting the price at
-- the moment a dish is added makes what a diner ordered mean exactly
-- what they were shown at the time, immune to later menu edits.
alter table order_items add column price_cents int;

update order_items oi
set price_cents = mi.price_cents
from menu_items mi
where mi.id = oi.menu_item_id and oi.price_cents is null;

alter table order_items alter column price_cents set not null;

-- Recreated to also take and store the price at insert time. The
-- ON CONFLICT branch (bumping quantity on an existing still-unsent line)
-- deliberately leaves price_cents untouched — it was already set when
-- that line was first created.
create or replace function add_item_to_cart(
  p_table_session_id uuid,
  p_participant_id uuid,
  p_menu_item_id uuid,
  p_price_cents int
) returns void
language sql
as $$
  insert into order_items (table_session_id, participant_id, menu_item_id, quantity, price_cents)
  values (p_table_session_id, p_participant_id, p_menu_item_id, 1, p_price_cents)
  on conflict (table_session_id, participant_id, menu_item_id) where order_id is null
  do update set quantity = order_items.quantity + 1;
$$;
