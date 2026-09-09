-- Closes 2 real "shared mutable balance with no locking" races found in
-- review: two diners paying the same table/dish at nearly the same
-- instant could both read the same "remaining" balance before either
-- write landed, and both succeed — overcharging the table. Same root
-- cause let a participant's loyalty discount be granted twice off one
-- threshold's worth of stamps (eligibility was checked live at payment
-- creation, stamps were only actually spent later at confirmation, so a
-- second payment started before the first confirmed saw the same
-- not-yet-spent stamp count).
--
-- Both fixes follow the same pattern already used for the cart in
-- migration 0016: move the read-check-write into a single Postgres
-- function so it's atomic, and take an advisory lock (transaction-scoped,
-- released automatically) keyed to the row(s) being contended for so
-- concurrent callers serialize instead of racing.

create or replace function create_payment_share(
  p_table_session_id uuid,
  p_restaurant_id uuid,
  p_participant_id uuid,
  p_mode text,
  p_amount_cents int,
  p_tip_cents int,
  p_loyalty_discount_cents int,
  p_charged_cents int
) returns uuid
language plpgsql
as $$
declare
  v_total_cents bigint;
  v_paid_cents bigint;
  v_remaining_cents bigint;
  v_share_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_table_session_id::text, 0));

  select coalesce(sum(mi.price_cents * oi.quantity), 0) into v_total_cents
  from order_items oi
  join menu_items mi on mi.id = oi.menu_item_id
  where oi.table_session_id = p_table_session_id;

  select coalesce(sum(amount_cents), 0) into v_paid_cents
  from payment_shares
  where table_session_id = p_table_session_id and status = 'succeeded';

  v_remaining_cents := greatest(0, v_total_cents - v_paid_cents);

  -- The caller already computed p_amount_cents against its own read of
  -- the balance, which may be stale by the time this lock is acquired —
  -- re-validate against a fresh number taken under the lock rather than
  -- trusting it, and refuse rather than silently overcharge.
  if p_amount_cents > v_remaining_cents then
    raise exception 'amount_exceeds_remaining';
  end if;

  insert into payment_shares (
    restaurant_id, table_session_id, participant_id, mode,
    amount_cents, tip_cents, loyalty_discount_cents, charged_cents
  ) values (
    p_restaurant_id, p_table_session_id, p_participant_id, p_mode,
    p_amount_cents, p_tip_cents, p_loyalty_discount_cents, p_charged_cents
  )
  returning id into v_share_id;

  return v_share_id;
end;
$$;

-- Reserves the discount immediately (spends the stamps right away)
-- instead of only previewing eligibility — a second payment started
-- before the first one is confirmed now sees the already-reduced stamp
-- count instead of the same stale one. If a reserved payment never
-- completes (rejected cash request, failed card charge), the stamps are
-- restored explicitly by the caller — see restore_loyalty_stamps below.
--
-- LOYALTY_STAMP_THRESHOLD/LOYALTY_DISCOUNT_PERCENT are hardcoded here to
-- match src/lib/loyalty.ts — keep both in sync if that ever changes.
create or replace function reserve_loyalty_discount(
  p_restaurant_id uuid,
  p_email text,
  p_base_amount_cents int
) returns int
language plpgsql
as $$
declare
  v_stamps int;
  v_discount_cents int;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_restaurant_id::text || ':' || p_email, 0));

  select stamps into v_stamps
  from loyalty_accounts
  where restaurant_id = p_restaurant_id and email = p_email;

  if v_stamps is null or v_stamps < 10 then
    return 0;
  end if;

  v_discount_cents := round(p_base_amount_cents * 10 / 100.0);

  update loyalty_accounts
  set stamps = stamps - 10, updated_at = now()
  where restaurant_id = p_restaurant_id and email = p_email;

  return v_discount_cents;
end;
$$;

create or replace function restore_loyalty_stamps(
  p_restaurant_id uuid,
  p_email text
) returns void
language sql
as $$
  update loyalty_accounts
  set stamps = stamps + 10, updated_at = now()
  where restaurant_id = p_restaurant_id and email = p_email;
$$;

-- A refunded/disputed payment previously stayed 'succeeded' forever —
-- getTableBillSummary would go on treating that money as collected with
-- no way to fix it short of manual SQL. 'refunded' shares are excluded
-- from that sum the same way 'pending'/'failed' already are.
alter table payment_shares drop constraint payment_shares_status_check;
alter table payment_shares add constraint payment_shares_status_check
  check (status in ('pending', 'succeeded', 'failed', 'refunded'));
