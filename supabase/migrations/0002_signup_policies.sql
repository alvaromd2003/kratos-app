-- Lets a newly signed-up user create their own restaurant and claim
-- ownership of it. Claiming is only allowed while the restaurant has no
-- members yet, so an existing restaurant can't be hijacked this way.

create policy "authenticated users can create a restaurant" on restaurants
  for insert
  to authenticated
  with check (true);

create policy "user can claim a brand-new restaurant as owner" on restaurant_users
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and role = 'owner'
    and not exists (
      select 1 from restaurant_users existing
      where existing.restaurant_id = restaurant_users.restaurant_id
    )
  );
