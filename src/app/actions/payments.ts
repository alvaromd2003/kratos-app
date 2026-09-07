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

export type PaymentFormState = { error?: string } | undefined

type PaymentMode = 'individual' | 'split' | 'collective'
type AdminClient = ReturnType<typeof createAdminClient>
type VerifiedTable = { restaurant_id: string; label: string }
type VerifiedParticipant = { participantId: string; tableSessionId: string }

// Shared by all 3 modes below — they only differ in how amountCents gets
// computed. Creates the pending payment_shares row, then a Stripe Checkout
// Session for it (a destination charge straight to the restaurant's
// connected account — Kratos takes no cut for now), and redirects the
// diner's browser to Stripe's hosted payment page.
async function createPaymentCheckout(
  admin: AdminClient,
  qrToken: string,
  table: VerifiedTable,
  verified: VerifiedParticipant,
  mode: PaymentMode,
  amountCents: number
): Promise<PaymentFormState> {
  if (amountCents <= 0) {
    return { error: 'No hay nada pendiente de pagar.' }
  }

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('currency, stripe_account_id, stripe_onboarding_complete')
    .eq('id', table.restaurant_id)
    .maybeSingle()

  if (!restaurant?.stripe_onboarding_complete || !restaurant.stripe_account_id) {
    return { error: 'Este restaurante todavía no acepta pagos por la app.' }
  }

  const { data: share, error: insertError } = await admin
    .from('payment_shares')
    .insert({
      restaurant_id: table.restaurant_id,
      table_session_id: verified.tableSessionId,
      participant_id: verified.participantId,
      mode,
      amount_cents: amountCents,
    })
    .select('id')
    .single()

  if (insertError || !share) {
    return { error: 'No se pudo iniciar el pago. Inténtalo de nuevo.' }
  }

  const origin = await getRequestOrigin()
  let checkoutUrl: string | null = null

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      // Pinned explicitly rather than left to the Dashboard's payment
      // method configuration — Apple Pay/Google Pay still render
      // automatically on top of 'card' when the diner's device supports
      // them, no separate entry needed for those.
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: restaurant.currency.toLowerCase(),
            product_data: { name: `Mesa ${table.label} — Kratos` },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
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

  return createPaymentCheckout(admin, qrToken, table, verified, 'individual', amountCents)
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

  return createPaymentCheckout(admin, qrToken, table, verified, 'split', amountCents)
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

  return createPaymentCheckout(admin, qrToken, table, verified, 'collective', summary.remainingCents)
}
