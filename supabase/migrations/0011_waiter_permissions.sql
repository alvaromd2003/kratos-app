-- Run this AFTER 0010 (needs the 'waiter' enum value to already exist).
--
-- Splitting "kitchen_staff" (food prep only) from the new "waiter" role
-- (serves tables, closes them out, answers help calls) so each operational
-- screen only does what that job actually needs.

drop policy "staff can close table sessions" on table_sessions;

create policy "waiter/owner/admin can close table sessions" on table_sessions
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'waiter']::restaurant_role[])
  );

-- The waiter marks orders "delivered" (kitchen_staff already could set
-- preparing/ready) — the app itself still restricts who can set which
-- exact status, this just gives the role DB-level room to do its part.
drop policy "kitchen staff can update order status" on orders;

create policy "staff can update order status" on orders
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'kitchen_staff', 'waiter']::restaurant_role[])
  );
