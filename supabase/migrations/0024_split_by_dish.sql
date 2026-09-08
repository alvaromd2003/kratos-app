-- "División por plato" now supports splitting a single shared dish among
-- several people, not just paying it whole. A dish can be covered by
-- several separate payments over time (each person's fraction) — this
-- records exactly how much of the dish's price each one covered, so we
-- can tell "fully paid" from "partially paid" instead of a plain
-- claimed/unclaimed flag.
alter table payment_share_items
  add column amount_cents int not null default 0;
