-- Cash isn't verified by Stripe, so it can't just be marked paid the
-- moment a diner taps the button — that would reopen the exact
-- silent-cancel-style fraud risk the order-cancellation flow was built to
-- close. A cash request sits 'pending' until staff physically receive the
-- money and confirm it on /admin/floor (or reject it, e.g. the diner
-- changes their mind and pays by card instead). Only ever the full
-- remaining balance — no partial cash shares, to keep "how much is left"
-- unambiguous.

alter table payment_shares drop constraint payment_shares_mode_check;
alter table payment_shares add constraint payment_shares_mode_check
  check (mode in ('individual', 'split', 'collective', 'cash'));

create policy "staff can confirm cash payments" on payment_shares
  for update using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'waiter']::restaurant_role[])
    and mode = 'cash'
  );

create policy "staff can reject cash payments" on payment_shares
  for delete using (
    is_restaurant_staff(restaurant_id, array['owner', 'admin', 'waiter']::restaurant_role[])
    and mode = 'cash'
  );
