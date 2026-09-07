import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getTableBillSummary } from '@/lib/payments'

// Hardcoded for now — easy to move to a per-restaurant setting later if
// an owner ever asks to tune it.
export const LOYALTY_STAMP_THRESHOLD = 10
export const LOYALTY_DISCOUNT_PERCENT = 10

export function loyaltyDiscountCents(baseAmountCents: number, stamps: number): number {
  if (stamps < LOYALTY_STAMP_THRESHOLD) return 0
  return Math.round((baseAmountCents * LOYALTY_DISCOUNT_PERCENT) / 100)
}

// How much a discount would this specific participant get on this
// specific payment, based on the stamps tied to their opted-in email (if
// any). Returns 0 if they never gave an email.
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

  const { data: account } = await admin
    .from('loyalty_accounts')
    .select('stamps')
    .eq('restaurant_id', restaurantId)
    .eq('email', email)
    .maybeSingle()

  return loyaltyDiscountCents(baseAmountCents, account?.stamps ?? 0)
}

// Called after any payment succeeds — once the table's bill is fully
// settled, every participant who opted in with an email gets exactly 1
// stamp for this visit (never more than 1, however many separate
// payments it took to get there).
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

// Called once a payment that actually redeemed a discount succeeds —
// spends the threshold's worth of stamps (not a reset to 0, in case more
// had piled up since).
export async function redeemLoyaltyStamps(
  admin: SupabaseClient,
  paymentShareId: string
): Promise<void> {
  const { data: share } = await admin
    .from('payment_shares')
    .select('restaurant_id, participant_id, loyalty_discount_cents')
    .eq('id', paymentShareId)
    .maybeSingle()

  if (!share || share.loyalty_discount_cents <= 0) return

  const { data: participant } = await admin
    .from('session_participants')
    .select('loyalty_email')
    .eq('id', share.participant_id)
    .maybeSingle()

  const email = participant?.loyalty_email
  if (!email) return

  const { data: account } = await admin
    .from('loyalty_accounts')
    .select('stamps')
    .eq('restaurant_id', share.restaurant_id)
    .eq('email', email)
    .maybeSingle()

  await admin
    .from('loyalty_accounts')
    .update({
      stamps: Math.max(0, (account?.stamps ?? 0) - LOYALTY_STAMP_THRESHOLD),
      updated_at: new Date().toISOString(),
    })
    .eq('restaurant_id', share.restaurant_id)
    .eq('email', email)
}
