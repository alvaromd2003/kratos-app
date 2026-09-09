'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getVerifiedParticipant } from '@/lib/ordering'
import {
  getRequestOrigin,
  getTableBillSummary,
  getOrderItemCoverage,
  totalOrderItemCoverage,
  individualAmountDue,
  splitAmountDue,
} from '@/lib/payments'
import { stripe } from '@/lib/stripe'
import { OPTIONAL_PAYMENT_METHODS } from '@/lib/payment-methods'
import { getParticipantLoyaltyDiscount, restoreLoyaltyStampsForParticipant } from '@/lib/loyalty'
import type Stripe from 'stripe'

export type PaymentFormState = { errorCode?: string } | undefined

type PaymentMode = 'individual' | 'split' | 'collective' | 'items'
type AdminClient = ReturnType<typeof createAdminClient>
type VerifiedTable = { restaurant_id: string; label: string }
type VerifiedParticipant = { participantId: string; tableSessionId: string }

const ALLOWED_TIP_PERCENTS = [0, 5, 10, 15]

// Shared by all 3 modes below — they only differ in how amountCents gets
// computed. amountCents is the bill amount being settled and must stay
// exactly that (see src/lib/payments.ts and the migration comment for
// why) — tip and any loyalty discount are tracked separately and only
// affect what's actually charged, never the shared table balance.
// Creates the pending payment_shares row, then a Stripe Checkout Session
// for it (a destination charge straight to the restaurant's connected
// account — Kratos takes no cut for now), and redirects the diner's
// browser to Stripe's hosted payment page.
async function createPaymentCheckout(
  admin: AdminClient,
  qrToken: string,
  table: VerifiedTable,
  verified: VerifiedParticipant,
  mode: PaymentMode,
  amountCents: number,
  tipCents: number,
  orderItemShares?: Map<string, number>
): Promise<PaymentFormState> {
  if (amountCents <= 0) {
    return { errorCode: 'NOTHING_TO_PAY' }
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('currency, stripe_account_id, stripe_onboarding_complete, enabled_payment_methods')
    .eq('id', table.restaurant_id)
    .maybeSingle()

  if (!restaurant?.stripe_onboarding_complete || !restaurant.stripe_account_id) {
    return { errorCode: 'PAYMENTS_NOT_ENABLED' }
  }

  const discountCents = await getParticipantLoyaltyDiscount(
    admin,
    verified.participantId,
    table.restaurant_id,
    amountCents
  )
  const chargedCents = amountCents - discountCents + tipCents

  // Atomic: re-validates amountCents against a FRESH remaining balance
  // (computed under an advisory lock, not trusting this function's own
  // possibly-stale read) before inserting — closes the race where two
  // diners paying the same table/dish at nearly the same instant could
  // otherwise both succeed against money that's already spoken for.
  const { data: shareId, error: insertError } = await admin.rpc('create_payment_share', {
    p_table_session_id: verified.tableSessionId,
    p_restaurant_id: table.restaurant_id,
    p_participant_id: verified.participantId,
    p_mode: mode,
    p_amount_cents: amountCents,
    p_tip_cents: tipCents,
    p_loyalty_discount_cents: discountCents,
    p_charged_cents: chargedCents,
  })

  if (insertError || !shareId) {
    // The reserved loyalty discount (if any) is now stranded — this
    // payment never got created, so give the stamps back.
    if (discountCents > 0) {
      await restoreLoyaltyStampsForParticipant(admin, verified.participantId, table.restaurant_id)
    }
    if (insertError?.message?.includes('amount_exceeds_remaining')) {
      return { errorCode: 'BILL_CHANGED_RACE' }
    }
    return { errorCode: 'COULD_NOT_START_PAYMENT' }
  }
  const share = { id: shareId as string }

  if (orderItemShares && orderItemShares.size > 0) {
    await admin.from('payment_share_items').insert(
      [...orderItemShares.entries()].map(([orderItemId, shareCents]) => ({
        payment_share_id: share.id,
        order_item_id: orderItemId,
        amount_cents: shareCents,
      }))
    )
  }

  const origin = await getRequestOrigin()
  let checkoutUrl: string | null = null

  // Card is always offered; anything else is the restaurant owner's own
  // choice from Ajustes — re-checked against currency here too (e.g.
  // Bizum only ever settles in EUR) rather than trusting the stored list
  // blindly, in case the restaurant changed currency after choosing it.
  const paymentMethodTypes = [
    'card',
    ...OPTIONAL_PAYMENT_METHODS.filter(
      (m) =>
        restaurant.enabled_payment_methods.includes(m.value) &&
        (!m.euroOnly || restaurant.currency.toUpperCase() === 'EUR')
    ).map((m) => m.value),
  ] as Stripe.Checkout.SessionCreateParams.PaymentMethodType[]

  const billLineName =
    discountCents > 0
      ? `Mesa ${table.label} — Kratos (descuento fidelidad aplicado)`
      : `Mesa ${table.label} — Kratos`

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    {
      price_data: {
        currency: restaurant.currency.toLowerCase(),
        product_data: { name: billLineName },
        unit_amount: amountCents - discountCents,
      },
      quantity: 1,
    },
  ]
  if (tipCents > 0) {
    lineItems.push({
      price_data: {
        currency: restaurant.currency.toLowerCase(),
        product_data: { name: 'Propina' },
        unit_amount: tipCents,
      },
      quantity: 1,
    })
  }

  let amountTooSmall = false

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Pinned explicitly rather than left to the Dashboard's payment
      // method configuration — Apple Pay/Google Pay still render
      // automatically on top of 'card' when the diner's device supports
      // them, no separate entry needed for those.
      payment_method_types: paymentMethodTypes,
      line_items: lineItems,
      payment_intent_data: {
        transfer_data: { destination: restaurant.stripe_account_id },
      },
      metadata: { payment_share_id: share.id },
      success_url: `${origin}/t/${qrToken}?payment=success`,
      cancel_url: `${origin}/t/${qrToken}?payment=cancelled`,
    })
    checkoutUrl = session.url
    if (checkoutUrl) {
      await admin
        .from('payment_shares')
        .update({ stripe_checkout_session_id: session.id })
        .eq('id', share.id)
    }
  } catch (err) {
    checkoutUrl = null
    // Stripe enforces a minimum charge per currency (~0.50€) — without
    // this, a diner left with a tiny remainder (e.g. their share of just
    // a side dish) would hit the generic "try again" error forever, with
    // no way to actually pay it by card.
    amountTooSmall =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code?: string }).code === 'amount_too_small'
  }

  if (!checkoutUrl) {
    if (discountCents > 0) {
      await restoreLoyaltyStampsForParticipant(admin, verified.participantId, table.restaurant_id)
    }
    await admin.from('payment_shares').delete().eq('id', share.id)
    if (amountTooSmall) {
      return { errorCode: 'AMOUNT_TOO_SMALL' }
    }
    return { errorCode: 'STRIPE_CONNECTION_ERROR' }
  }

  redirect(checkoutUrl)
}

function tipCentsFromFormData(formData: FormData, amountCents: number): number {
  const percent = Number(formData.get('tip_percent') ?? 0)
  if (!ALLOWED_TIP_PERCENTS.includes(percent)) return 0
  return Math.round((amountCents * percent) / 100)
}

export async function createIndividualPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { errorCode: 'SESSION_EXPIRED' }
  }

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, verified.tableSessionId)
  const amountCents = individualAmountDue(summary, verified.participantId)
  const tipCents = tipCentsFromFormData(formData, amountCents)

  return createPaymentCheckout(admin, qrToken, table, verified, 'individual', amountCents, tipCents)
}

export async function createSplitPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const shareCount = Math.max(1, Math.floor(Number(formData.get('share_count') ?? 1)))

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { errorCode: 'SESSION_EXPIRED' }
  }

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, verified.tableSessionId)
  const amountCents = splitAmountDue(summary, shareCount)
  const tipCents = tipCentsFromFormData(formData, amountCents)

  return createPaymentCheckout(admin, qrToken, table, verified, 'split', amountCents, tipCents)
}

export async function createCollectivePayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { errorCode: 'SESSION_EXPIRED' }
  }

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, verified.tableSessionId)
  const tipCents = tipCentsFromFormData(formData, summary.remainingCents)

  return createPaymentCheckout(
    admin,
    qrToken,
    table,
    verified,
    'collective',
    summary.remainingCents,
    tipCents
  )
}

// Lets a diner cover exactly the dishes they pick — anyone's at the
// table, not just their own (covering a shared starter, or someone
// else's dessert as a treat) — instead of a fixed individual/split/
// collective amount. Each selected dish can also be split with a
// "dividir entre N": the amount is always N-ths of what's *currently*
// left unpaid on that specific line (never the dish's original price),
// so several people can each cover their share without agreeing on a
// share count up front — same self-correcting idea as the whole-bill
// "dividido" mode, just applied per dish.
export async function createItemizedPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemIds = formData
    .getAll('order_item_id')
    .map(String)
    .filter((id) => id.length > 0)

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { errorCode: 'SESSION_EXPIRED' }
  }

  if (orderItemIds.length === 0) {
    return { errorCode: 'SELECT_AT_LEAST_ONE_ITEM' }
  }

  const admin = createAdminClient()

  const summary = await getTableBillSummary(admin, verified.tableSessionId)
  if (summary.remainingCents <= 0) {
    return { errorCode: 'BILL_ALREADY_PAID' }
  }

  // Re-derive everything from the DB — never trust client-supplied ids
  // or amounts blindly. price_cents is the snapshot taken when the dish
  // was added, not a live menu_items join — a price edit after the fact
  // must never change what's owed on an already-placed order.
  const [{ data: items }, coverage] = await Promise.all([
    admin
      .from('order_items')
      .select('id, quantity, price_cents')
      .eq('table_session_id', verified.tableSessionId)
      .in('id', orderItemIds),
    getOrderItemCoverage(admin, verified.tableSessionId),
  ])

  const orderItemShares = new Map<string, number>()
  for (const item of items ?? []) {
    const fullCents = item.price_cents * item.quantity
    const itemRemainingCents = fullCents - totalOrderItemCoverage(coverage.get(item.id))
    if (itemRemainingCents <= 0) continue // fully paid already since the picker loaded — skip it

    const shareCountRaw = Math.floor(Number(formData.get(`share_count_${item.id}`) ?? 1))
    const shareCount = Number.isFinite(shareCountRaw) && shareCountRaw > 0 ? shareCountRaw : 1
    orderItemShares.set(item.id, Math.min(itemRemainingCents, Math.ceil(itemRemainingCents / shareCount)))
  }

  if (orderItemShares.size === 0) {
    return { errorCode: 'ITEMS_ALREADY_PAID' }
  }

  // The per-dish "still owed" figures above only look at itemized
  // (payment_share_items) coverage — they don't know about money already
  // collected on this same table via individual/split/collective, which
  // reduces summary.remainingCents without ever touching per-dish
  // coverage. Cap the total so mixing payment modes can never collect
  // more than the table genuinely still owes, scaling every dish's share
  // down proportionally if the uncapped total would exceed it.
  let amountCents = [...orderItemShares.values()].reduce((sum, cents) => sum + cents, 0)
  if (amountCents > summary.remainingCents) {
    const scale = summary.remainingCents / amountCents
    const entries = [...orderItemShares.entries()]
    let allocated = 0
    entries.forEach(([id, cents], index) => {
      const isLast = index === entries.length - 1
      const scaledCents = isLast
        ? summary.remainingCents - allocated
        : Math.floor(cents * scale)
      allocated += scaledCents
      if (scaledCents > 0) {
        orderItemShares.set(id, scaledCents)
      } else {
        orderItemShares.delete(id)
      }
    })
    amountCents = summary.remainingCents
  }
  const tipCents = tipCentsFromFormData(formData, amountCents)

  return createPaymentCheckout(
    admin,
    qrToken,
    table,
    verified,
    'items',
    amountCents,
    tipCents,
    orderItemShares
  )
}

// Cash isn't verified by Stripe, so it can't be marked paid the instant a
// diner taps the button — it sits 'pending' until staff physically
// receive the money and confirm it from /admin/floor (see
// confirmCashPayment/rejectCashPayment in actions/kitchen.ts). Always the
// full remaining balance, never a partial share, so there's no ambiguity
// about how much cash staff should be expecting.
export async function requestCashPayment(
  _prevState: PaymentFormState,
  formData: FormData
): Promise<PaymentFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { errorCode: 'SESSION_EXPIRED' }
  }

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, verified.tableSessionId)

  if (summary.remainingCents <= 0) {
    return { errorCode: 'NOTHING_TO_PAY' }
  }

  const { data: existing } = await admin
    .from('payment_shares')
    .select('id')
    .eq('table_session_id', verified.tableSessionId)
    .eq('mode', 'cash')
    .eq('status', 'pending')
    .maybeSingle()
  if (existing) return

  // No tip step for cash (left directly, the traditional way) — but the
  // loyalty discount still applies, same as any other mode.
  const discountCents = await getParticipantLoyaltyDiscount(
    admin,
    verified.participantId,
    table.restaurant_id,
    summary.remainingCents
  )

  const { error } = await admin.rpc('create_payment_share', {
    p_table_session_id: verified.tableSessionId,
    p_restaurant_id: table.restaurant_id,
    p_participant_id: verified.participantId,
    p_mode: 'cash',
    p_amount_cents: summary.remainingCents,
    p_tip_cents: 0,
    p_loyalty_discount_cents: discountCents,
    p_charged_cents: summary.remainingCents - discountCents,
  })

  if (error) {
    if (discountCents > 0) {
      await restoreLoyaltyStampsForParticipant(admin, verified.participantId, table.restaurant_id)
    }
    return { errorCode: 'COULD_NOT_NOTIFY_STAFF' }
  }
}
