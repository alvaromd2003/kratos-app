-- Optional time-of-day window a dish is orderable in (e.g. breakfast-only
-- items) instead of the owner toggling is_available by hand at set
-- times. Null in either column means "always available" — existing
-- items are unaffected.
alter table menu_items
  add column available_from time,
  add column available_until time;
