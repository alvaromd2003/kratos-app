import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTableBillSummary } from '@/lib/payments'

// Hardcoded for now — easy to move to a per-restaurant setting later if
// an owner ever asks to tune it. Also hardcoded (kept in sync manually)
// inside the reserve_loyalty_discount/restore_loyalty_stamps Postgres
// functions, migration 0029 — update both places together.
export const LOYALTY_STAMP_THRESHOLD = 10
export const LOYALTY_DISCOUNT_PERCENT = 10

export function loyaltyDiscountCents(baseAmountCents: number, stamps: number): number {
  if (stamps < LOYALTY_STAMP_THRESHOLD) return 0
  return Math.round((baseAmountCents * LOYALTY_DISCOUNT_PERCENT) / 100)
}

// How much discount this specific participant gets on this specific
// payment, based on the stamps tied to their opted-in email (if any) —
// and, critically, SPENDS that threshold's worth of stamps immediately
// via the reserve_loyalty_discount RPC rather than just previewing
// eligibility. Two payments started moments apart (one still on Stripe's
// page, a second one starting) used to both read the same live stamp
// count and both get offered the discount, since stamps were only
// actually decremented later once a payment succeeded — spending them
// up front closes that race. If this payment never completes, the
// caller must call restoreLoyaltyStamps to give them back (see
// requestCashPayment/rejectCashPayment, and the webhook's
// async_payment_failed handler).
export async function getParticipantLoyaltyDiscount(
  admin: SupabaseClient,
  participantId: string,
  restaurantId: string,
  baseAmountCents: number
): Promise<number> {
  const { data: participant } = await admin
    .from('session_participants')
    .select('loyalty_email')
    .eq('id', participantId)
    .maybeSingle()

  const email = participant?.loyalty_email
  if (!email) return 0

  const { data: discountCents, error } = await admin.rpc('reserve_loyalty_discount', {
    p_restaurant_id: restaurantId,
    p_email: email,
    p_base_amount_cents: baseAmountCents,
  })

  if (error || discountCents === null) return 0
  return discountCents
}

// Gives back the stamps a payment reserved, for when it turns out that
// payment never actually completed (staff rejected a cash request, a
// card charge definitively failed). A no-op if the participant never
// gave a loyalty email or nothing was reserved (share.loyalty_discount_cents
// is 0), so it's safe to call unconditionally on any pending share being
// torn down.
export async function restoreLoyaltyStamps(
  admin: SupabaseClient,
  paymentShareId: string
): Promise<void> {
  const { data: share } = await admin
    .from('payment_shares')
    .select('restaurant_id, participant_id, loyalty_discount_cents')
    .eq('id', paymentShareId)
    .maybeSingle()
  if (!share || share.loyalty_discount_cents <= 0) return

  await restoreLoyaltyStampsForParticipant(admin, share.participant_id, share.restaurant_id)
}

// Same restoration, for the one place a payment can fail to even reach a
// payment_shares row (createPaymentCheckout's own insert getting rejected
// by create_payment_share) — there's no share id to look up yet, but the
// caller already knows the discount it reserved a moment ago.
export async function restoreLoyaltyStampsForParticipant(
  admin: SupabaseClient,
  participantId: string,
  restaurantId: string
): Promise<void> {
  const { data: participant } = await admin
    .from('session_participants')
    .select('loyalty_email')
    .eq('id', participantId)
    .maybeSingle()
  const email = participant?.loyalty_email
  if (!email) return

  await admin.rpc('restore_loyalty_stamps', {
    p_restaurant_id: restaurantId,
    p_email: email,
  })
}

// Called after any payment succeeds — once the table's bill is fully
// settled, every participant who opted in with an email gets exactly 1
// stamp for this visit (never more than 1, however many separate
// payments it took to get there). Unrelated to the discount-reservation
// above: this awards a NEW stamp for the visit, that one spends existing
// stamps on a discount.
export async function awardLoyaltyStampsIfFullyPaid(
  admin: SupabaseClient,
  tableSessionId: string,
  restaurantId: string
): Promise<void> {
  const summary = await getTableBillSummary(admin, tableSessionId)
  if (summary.remainingCents > 0) return

  const { data: participants } = await admin
    .from('session_participants')
    .select('id, loyalty_email')
    .eq('table_session_id', tableSessionId)
    .eq('loyalty_stamp_awarded', false)
    .not('loyalty_email', 'is', null)

  for (const participant of participants ?? []) {
    if (!participant.loyalty_email) continue

    const { data: existing } = await admin
      .from('loyalty_accounts')
      .select('stamps')
      .eq('restaurant_id', restaurantId)
      .eq('email', participant.loyalty_email)
      .maybeSingle()

    await admin.from('loyalty_accounts').upsert(
      {
        restaurant_id: restaurantId,
        email: participant.loyalty_email,
        stamps: (existing?.stamps ?? 0) + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'restaurant_id,email' }
    )

    await admin
      .from('session_participants')
      .update({ loyalty_stamp_awarded: true })
      .eq('id', participant.id)
  }
}
