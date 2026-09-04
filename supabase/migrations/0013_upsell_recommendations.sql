-- Lets the owner mark "when someone adds this dish, suggest this other
-- one" (e.g. burger -> fries) — a lightweight upsell prompt on the public
-- menu. Self-referencing, so a deleted dish just clears the recommendation
-- instead of blocking the delete.
alter table menu_items
  add column recommended_item_id uuid references menu_items (id) on delete set null;
