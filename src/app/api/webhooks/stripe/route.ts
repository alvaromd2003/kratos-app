import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import type Stripe from 'stripe'

// Needs the raw request body to verify Stripe's signature — must run on
// the Node.js runtime, not Edge.
export const runtime = 'nodejs'

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

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const paymentShareId = session.metadata?.payment_share_id

    if (paymentShareId) {
      const admin = createAdminClient()
      await admin
        .from('payment_shares')
        .update({
          status: 'succeeded',
          stripe_payment_intent_id:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', paymentShareId)
        .eq('status', 'pending')
    }
  }

  return new Response('ok', { status: 200 })
}
