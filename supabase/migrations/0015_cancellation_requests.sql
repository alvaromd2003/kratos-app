-- A diner can no longer cancel a pending order outright — they request a
-- cancellation, and kitchen confirms or rejects it (they may have already
-- started on it even though the status still says "pending").
alter table orders add column cancellation_requested_at timestamptz;
