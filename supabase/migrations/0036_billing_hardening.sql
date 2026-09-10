-- Further hardening from the 3rd code-review pass, on top of 0035's
-- protect-billing-columns trigger.

-- (1) Lets the webhook handler detect and ignore an out-of-order event
-- (Stripe does not guarantee delivery order across different events) instead
-- of a stale retry/replay reverting billing_status back to an old value.
alter table restaurants add column billing_last_event_at timestamptz;

-- Also protect the new column with the same trigger from migration 0035 —
-- a restaurant tampering with this timestamp directly could otherwise make
-- a genuinely-stale webhook event look "newest" and get applied anyway.
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
       or new.billing_last_event_at is distinct from old.billing_last_event_at
    then
      raise exception 'billing columns can only be changed by the platform, not by a restaurant account';
    end if;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- (2) The plain RLS "owner/admin can read their restaurant" policy has no
-- role filter, so any staff role (including kitchen_staff/waiter) could
-- read these two Stripe identifiers via a direct REST call — RLS is
-- row-scoped only, so column-level privileges are the actual fix. This
-- only affects normal user sessions ('authenticated'); the service-role
-- client used by the webhook and the platform admin page is unaffected.
revoke select (billing_customer_id, billing_subscription_id) on restaurants from authenticated;

-- (3) Every subscription webhook event filters on this column.
create index if not exists restaurants_billing_subscription_id_idx on restaurants (billing_subscription_id);
