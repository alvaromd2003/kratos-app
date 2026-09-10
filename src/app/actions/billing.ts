'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getRequestOrigin } from '@/lib/payments'
import { stripe } from '@/lib/stripe'
import { getStandardPriceId, getFoundingCouponId, isFoundingEraActive } from '@/lib/billing'

export type BillingFormState = { errorCode?: string; checkoutUrl?: string } | undefined

async function requirePlatformAdmin() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformAdminEmail || user.email !== platformAdminEmail) {
    throw new Error('No autorizado')
  }
}

// Generates a Checkout link for one restaurant's monthly subscription — the
// platform owner copies it and sends it to the restaurant himself (see the
// admin-triggered flow decision) rather than the restaurant self-serving
// from their own Ajustes. Nothing is written to `restaurants` yet: the
// subscription only becomes real once the webhook sees a completed session.
export async function startRestaurantSubscription(
  _prevState: BillingFormState,
  formData: FormData
): Promise<BillingFormState> {
  await requirePlatformAdmin()

  const restaurantId = String(formData.get('restaurant_id') ?? '')
  const admin = createAdminClient()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('id, name, billing_customer_id, billing_subscription_id')
    .eq('id', restaurantId)
    .maybeSingle()

  if (!restaurant) {
    return { errorCode: 'RESTAURANT_NOT_FOUND' }
  }
  if (restaurant.billing_subscription_id) {
    return { errorCode: 'ALREADY_SUBSCRIBED' }
  }

  let customerId = restaurant.billing_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      name: restaurant.name,
      metadata: { restaurant_id: restaurant.id },
    })
    customerId = customer.id
    await admin.from('restaurants').update({ billing_customer_id: customerId }).eq('id', restaurant.id)
  }

  const founding = isFoundingEraActive()
  const standardPriceId = await getStandardPriceId()
  const origin = await getRequestOrigin()

  // The founding price is a time-limited deal, not the permanent price —
  // this message sits right next to the pay button so that's disclosed up
  // front (on top of the discount breakdown Checkout already shows for the
  // coupon below), not discovered as a surprise on month 7's invoice.
  const foundingNotice =
    'Precio de lanzamiento: 350€/mes durante los primeros 6 meses (250€ de descuento). A partir del 7º mes, la cuota vuelve a 600€/mes automáticamente. Puedes cancelar la suscripción cuando quieras.'

  let session
  try {
    session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      // Always the single 600€ price — the founding discount is a coupon
      // layered on top (see src/lib/billing.ts), not a second Price, so
      // Checkout renders the "600,00€ struck through → 350,00€" breakdown
      // natively instead of just a flat 350€ line with no context.
      line_items: [{ price: standardPriceId, quantity: 1 }],
      success_url: `${origin}/admin/platform?billing=success`,
      cancel_url: `${origin}/admin/platform?billing=cancelled`,
      client_reference_id: restaurant.id,
      metadata: { restaurant_id: restaurant.id, founding_era: founding ? 'true' : 'false' },
      subscription_data: {
        metadata: { restaurant_id: restaurant.id, founding_era: founding ? 'true' : 'false' },
      },
      ...(founding && {
        discounts: [{ coupon: await getFoundingCouponId() }],
        custom_text: {
          submit: { message: foundingNotice },
        },
      }),
    })
  } catch {
    return { errorCode: 'STRIPE_CHECKOUT_FAILED' }
  }

  if (!session.url) {
    return { errorCode: 'STRIPE_CHECKOUT_FAILED' }
  }

  return { checkoutUrl: session.url }
}
