import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { awardLoyaltyStampsIfFullyPaid, restoreLoyaltyStamps } from '@/lib/loyalty'
import type Stripe from 'stripe'

// Needs the raw request body to verify Stripe's signature — must run on
// the Node.js runtime, not Edge.
export const runtime = 'nodejs'

async function markSucceeded(
  admin: ReturnType<typeof createAdminClient>,
  paymentShareId: string,
  paymentIntentId: string | null
) {
  const { data: updated } = await admin
    .from('payment_shares')
    .update({
      status: 'succeeded',
      stripe_payment_intent_id: paymentIntentId,
      completed_at: new Date().toISOString(),
    })
    .eq('id', paymentShareId)
    .eq('status', 'pending')
    .select('table_session_id, restaurant_id')
    .maybeSingle()

  // No stamp-spending here anymore — getParticipantLoyaltyDiscount
  // already reserved (spent) the stamps up front when this payment was
  // created, closing a race where a second payment started before the
  // first confirmed could see the same not-yet-spent stamp count.
  if (updated) {
    await awardLoyaltyStampsIfFullyPaid(admin, updated.table_session_id, updated.restaurant_id)
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get('stripe-signature')
  const rawBody = await request.text()

  if (!signature) {
    return new Response('Missing signature', { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  const admin = createAdminClient()

  // A redirect-confirmed method still settling behind the scenes (Bizum
  // works this way) can report the *session* as "completed" before the
  // money has actually arrived — payment_status stays 'unpaid' until the
  // matching async_payment_succeeded event lands. Only a session that's
  // actually 'paid' (true for cards immediately, true for Bizum once it
  // clears) should ever mark a bill as settled — otherwise a diner's
  // table could get treated as paid while the charge is still pending,
  // or later fails outright.
  if (
    event.type === 'checkout.session.completed' ||
    event.type === 'checkout.session.async_payment_succeeded'
  ) {
    const session = event.data.object as Stripe.Checkout.Session
    const paymentShareId = session.metadata?.payment_share_id
    const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null

    if (paymentShareId && session.payment_status === 'paid') {
      await markSucceeded(admin, paymentShareId, paymentIntentId)
    }
  }

  if (event.type === 'checkout.session.async_payment_failed') {
    const session = event.data.object as Stripe.Checkout.Session
    const paymentShareId = session.metadata?.payment_share_id
    if (paymentShareId) {
      const { data: failed } = await admin
        .from('payment_shares')
        .update({ status: 'failed' })
        .eq('id', paymentShareId)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle()
      // A definitively failed charge never happened — give back any
      // loyalty stamps it reserved, or they'd be spent for nothing.
      if (failed) {
        await restoreLoyaltyStamps(admin, paymentShareId)
      }
    }
  }

  // A restaurant refunding a diner (dashboard action, or a card-issuer
  // chargeback) previously left the payment_shares row permanently
  // 'succeeded' — getTableBillSummary would go on treating that money as
  // collected forever, with no way to fix it short of manual SQL.
  if (event.type === 'charge.refunded') {
    const charge = event.data.object as Stripe.Charge
    const paymentIntentId =
      typeof charge.payment_intent === 'string' ? charge.payment_intent : null
    if (paymentIntentId) {
      await admin
        .from('payment_shares')
        .update({ status: 'refunded' })
        .eq('stripe_payment_intent_id', paymentIntentId)
        .eq('status', 'succeeded')
    }
  }

  return new Response('ok', { status: 200 })
}
