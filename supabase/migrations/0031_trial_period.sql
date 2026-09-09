-- Null for every restaurant that already exists (deliberately not
-- backfilled) — only restaurants created from now on via /admin/onboarding
-- get a real trial_ends_at, so nobody already using Kratos gets locked
-- out retroactively. getCurrentRestaurant() only enforces this when it's
-- actually set.
alter table restaurants add column trial_ends_at timestamptz;
