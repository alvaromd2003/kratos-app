-- Fase 5: Kratos billing restaurants for using the platform itself (separate
-- from the diner-payment Stripe Connect flow already in place). One Stripe
-- Customer + Subscription per restaurant, admin-triggered (the platform
-- owner starts it and sends the resulting Checkout link himself, rather
-- than a self-serve button) — see the founding-era pricing note below.
alter table restaurants add column billing_customer_id text;
alter table restaurants add column billing_subscription_id text;
alter table restaurants add column billing_status text;
alter table restaurants add column billing_started_at timestamptz;
alter table restaurants add column billing_stepped_up_at timestamptz;

-- Recorded at subscription-creation time (not derived later from the price)
-- so the 6-month 350->600 step-up cron only ever touches restaurants that
-- actually started on the discounted "founding" price — a restaurant that
-- signs up for billing after the founding era ends goes straight to the
-- standard price and is never touched by the step-up job.
alter table restaurants add column billing_is_founding_era boolean not null default false;
