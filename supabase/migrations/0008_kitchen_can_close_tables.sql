-- Closing a table when a group leaves is really a floor/service task, not
-- an owner-only one — kitchen_staff already marks orders "delivered", so
-- letting them close the table too matches how a real shift works.

drop policy "owner/admin can close table sessions" on table_sessions;

create policy "staff can close table sessions" on table_sessions
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'kitchen_staff']::restaurant_role[])
  );
