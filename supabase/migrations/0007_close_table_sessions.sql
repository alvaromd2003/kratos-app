-- Table sessions never closed on their own, so re-scanning a table's QR
-- for a new group of diners just kept adding them to the previous group's
-- still-open session — mixing their orders together. Staff now closes a
-- table explicitly (when the group leaves) so the next scan starts fresh,
-- and Phase 4 has a clear, finished session to total up and charge.

create policy "owner/admin can close table sessions" on table_sessions
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[])
  );
