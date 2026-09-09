-- Closes a live data leak: these 5 policies granted SELECT to literally
-- anyone (the anon key, shipped in every page's JS bundle) for every
-- currently-open table session across every restaurant, with no check on
-- which session the caller actually belonged to. Anyone on the internet
-- could read live diner names, emails, order contents, and payment
-- amounts for the whole platform without ever scanning a QR code.
--
-- They existed only so the diner-facing browser could hold a Realtime
-- subscription with the anon key (see the comments where they were
-- created). That's been replaced with getTableSessionSnapshot, a Server
-- Action that re-verifies the diner's own session from their cookie (the
-- same way every write already worked) before reading with the
-- service-role client — so dropping these is safe: staff access is
-- unaffected (it goes through the separate "staff can view ..." policies,
-- scoped by is_restaurant_staff), and diners now go through the verified
-- Server Action instead of a direct anon SELECT/Realtime subscription.
drop policy if exists "anyone can view an open table session" on table_sessions;
drop policy if exists "anyone can view participants of an open session" on session_participants;
drop policy if exists "anyone can view order items of an open session" on order_items;
drop policy if exists "anyone can view orders of an open session" on orders;
drop policy if exists "anyone can view payment shares of an open session" on payment_shares;
