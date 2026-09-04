-- Lets an existing owner/admin add OTHER users to their own restaurant's
-- staff (unlike the earlier "claim a brand-new restaurant" policy, which
-- only covers a user adding themselves to an empty restaurant).

create policy "owner/admin can add staff to their restaurant" on restaurant_users
  for insert
  to authenticated
  with check (
    is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[])
  );

create policy "owner/admin can remove staff from their restaurant" on restaurant_users
  for delete
  using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin']::restaurant_role[])
  );
