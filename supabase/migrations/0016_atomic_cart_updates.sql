-- addItemToCart and changeItemQuantity both did a SELECT to read the
-- current quantity, then a separate UPDATE/INSERT based on what they
-- read. Two rapid taps (a very normal way to add 2-3 of something, or
-- two diners nudging the same shared line at once) could both read the
-- same starting value before either write lands — one increment is lost.
-- These functions make the whole read-modify-write a single atomic
-- statement instead.

-- Guarantees at most one still-unsent cart line per (session, diner,
-- dish) — also what ON CONFLICT below targets.
create unique index order_items_cart_line
  on order_items (table_session_id, participant_id, menu_item_id)
  where order_id is null;

create function add_item_to_cart(
  p_table_session_id uuid,
  p_participant_id uuid,
  p_menu_item_id uuid
) returns void
language sql
as $$
  insert into order_items (table_session_id, participant_id, menu_item_id, quantity)
  values (p_table_session_id, p_participant_id, p_menu_item_id, 1)
  on conflict (table_session_id, participant_id, menu_item_id) where order_id is null
  do update set quantity = order_items.quantity + 1;
$$;

create function change_cart_item_quantity(
  p_order_item_id uuid,
  p_table_session_id uuid,
  p_delta int
) returns void
language plpgsql
as $$
begin
  update order_items
  set quantity = quantity + p_delta
  where id = p_order_item_id
    and table_session_id = p_table_session_id
    and order_id is null;

  delete from order_items
  where id = p_order_item_id
    and table_session_id = p_table_session_id
    and order_id is null
    and quantity <= 0;
end;
$$;
