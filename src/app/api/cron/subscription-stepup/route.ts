import { createAdminClient } from '@/lib/supabase/admin'
import { stripe } from '@/lib/stripe'
import { getBillingPrices } from '@/lib/billing'

export const runtime = 'nodejs'

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000

// Runs daily (see vercel.json). Vercel signs its own cron requests with
// this header when CRON_SECRET is set — rejects anyone else who finds the
// URL, since this moves real money if left open.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - SIX_MONTHS_MS).toISOString()

  const { data: dueRestaurants } = await admin
    .from('restaurants')
    .select('id, billing_subscription_id')
    .eq('billing_status', 'active')
    .eq('billing_is_founding_era', true)
    .is('billing_stepped_up_at', null)
    .lte('billing_started_at', cutoff)

  const { standardPriceId } = await getBillingPrices()
  let steppedUp = 0

  for (const restaurant of dueRestaurants ?? []) {
    if (!restaurant.billing_subscription_id) continue

    try {
      const subscription = await stripe.subscriptions.retrieve(restaurant.billing_subscription_id)
      const itemId = subscription.items.data[0]?.id
      if (!itemId) continue

      await stripe.subscriptions.update(restaurant.billing_subscription_id, {
        items: [{ id: itemId, price: standardPriceId }],
        proration_behavior: 'none',
      })

      await admin
        .from('restaurants')
        .update({ billing_stepped_up_at: new Date().toISOString() })
        .eq('id', restaurant.id)

      steppedUp++
    } catch {
      // Left for the next day's run — a transient Stripe error here
      // shouldn't ever silently mark a restaurant as stepped-up when it
      // wasn't actually updated (billing_stepped_up_at only gets set on
      // the success path above).
    }
  }

  return Response.json({ checked: dueRestaurants?.length ?? 0, steppedUp })
}
