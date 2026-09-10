-- Security fix (3rd code-review pass): the owner/admin "update their own
-- restaurant" RLS policy has a `using` clause but no column-level
-- restriction, and Postgres RLS is row-scoped only. That means any
-- restaurant owner/admin holding a normal session JWT could bypass every
-- Next.js server action and PATCH their own restaurant's billing_* columns
-- directly via the PostgREST REST API (e.g. `billing_status: 'active'`),
-- permanently granting themselves a paid subscription for free with zero
-- Stripe involvement. Those columns must only ever be written by the
-- service-role client (the billing server actions and the Stripe webhook).
create or replace function protect_billing_columns()
returns trigger as $$
begin
  if auth.role() <> 'service_role' then
    if new.billing_status is distinct from old.billing_status
       or new.billing_customer_id is distinct from old.billing_customer_id
       or new.billing_subscription_id is distinct from old.billing_subscription_id
       or new.billing_started_at is distinct from old.billing_started_at
       or new.billing_stepped_up_at is distinct from old.billing_stepped_up_at
       or new.billing_is_founding_era is distinct from old.billing_is_founding_era
    then
      raise exception 'billing columns can only be changed by the platform, not by a restaurant account';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists protect_billing_columns_trigger on restaurants;
create trigger protect_billing_columns_trigger
  before update on restaurants
  for each row execute function protect_billing_columns();
