'use server'

import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getVerifiedParticipant } from '@/lib/ordering'
import {
  getRequestOrigin,
  getTableBillSummary,
  individualAmountDue,
  splitAmountDue,
} from '@/lib/payments'
import { stripe } from '@/lib/stripe'
import { OPTIONAL_PAYMENT_METHODS } from '@/lib/payment-methods'
import { getParticipantLoyaltyDiscount } from '@/lib/loyalty'
import type Stripe from 'stripe'

export type PaymentFormState = { error?: string } | undefined

type PaymentMode = 'individual' | 'split' | 'collective'
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
  tipCents: number
): Promise<PaymentFormState> {
  if (amountCents <= 0) {
    return { error: 'No hay nada pendiente de pagar.' }
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('currency, stripe_account_id, stripe_onboarding_complete, enabled_payment_methods')
    .eq('id', table.restaurant_id)
    .maybeSingle()

  if (!restaurant?.stripe_onboarding_complete || !restaurant.stripe_account_id) {
    return { error: 'Este restaurante todavía no acepta pagos por la app.' }
  }

  const discountCents = await getParticipantLoyaltyDiscount(
    admin,
    verified.participantId,
    table.restaurant_id,
    amountCents
  )
  const chargedCents = amountCents - discountCents + tipCents

  const { data: share, error: insertError } = await admin
    .from('payment_shares')
    .insert({
      restaurant_id: table.restaurant_id,
      table_session_id: verified.tableSessionId,
      participant_id: verified.participantId,
      mode,
      amount_cents: amountCents,
      tip_cents: tipCents,
      loyalty_discount_cents: discountCents,
      charged_cents: chargedCents,
    })
    .select('id')
    .single()

  if (insertError || !share) {
    return { error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }
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
  } catch {
    checkoutUrl = null
  }

  if (!checkoutUrl) {
    await admin.from('payment_shares').delete().eq('id', share.id)
    return { error: 'No se pudo conectar con Stripe. Inténtalo de nuevo.' }
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
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
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
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
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
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
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
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
  }

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, verified.tableSessionId)

  if (summary.remainingCents <= 0) {
    return { error: 'No hay nada pendiente de pagar.' }
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

  const { error } = await admin.from('payment_shares').insert({
    restaurant_id: table.restaurant_id,
    table_session_id: verified.tableSessionId,
    participant_id: verified.participantId,
    mode: 'cash',
    amount_cents: summary.remainingCents,
    loyalty_discount_cents: discountCents,
    charged_cents: summary.remainingCents - discountCents,
  })

  if (error) {
    return { error: 'No se pudo avisar al personal. Inténtalo de nuevo.' }
  }
}
