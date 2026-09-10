import 'server-only'
import { stripe } from '@/lib/stripe'

// The one Stripe product covering Kratos's own subscription to restaurants
// (distinct from each restaurant's own Connect account used for diner
// payments) — created once in the Stripe dashboard, "Kratos — Suscripción
// mensual", with a single recurring monthly EUR price attached: 600€, the
// standard/permanent price. The 350€ "founding" price is applied as a
// COUPON on top of this price, not a second Price object — that's what
// makes Stripe's own Checkout page render the attention-grabbing "600,00€
// struck through, 350,00€ now" discount UI, and it also makes the 6-month
// expiry automatic (Stripe stops applying the coupon on its own), instead
// of needing a cron job to swap the subscription's price by hand.
const KRATOS_BILLING_PRODUCT_ID = 'prod_VELIC4TelO68zQ'
const STANDARD_PRICE_CENTS = 60000
const FOUNDING_DISCOUNT_CENTS = 25000 // 600€ - 350€
const FOUNDING_COUPON_ID = 'kratos-founding-6mo'

let standardPriceIdPromise: Promise<string> | null = null

async function loadStandardPriceId(): Promise<string> {
  const prices = await stripe.prices.list({ product: KRATOS_BILLING_PRODUCT_ID, active: true, limit: 10 })
  const standard = prices.data.find((p) => p.unit_amount === STANDARD_PRICE_CENTS && p.currency === 'eur')
  if (!standard) {
    throw new Error('No se encontró el precio de 600€ en el producto de Stripe.')
  }
  return standard.id
}

export function getStandardPriceId(): Promise<string> {
  if (!standardPriceIdPromise) {
    standardPriceIdPromise = loadStandardPriceId()
  }
  return standardPriceIdPromise
}

let foundingCouponIdPromise: Promise<string> | null = null

// Created on first use (not a dashboard step the user has to remember) —
// a fixed, known id so re-running this ever after just retrieves the same
// coupon instead of accumulating duplicates.
async function loadOrCreateFoundingCoupon(): Promise<string> {
  try {
    const existing = await stripe.coupons.retrieve(FOUNDING_COUPON_ID)
    if (!existing.deleted) return existing.id
  } catch {
    // Doesn't exist yet — fall through and create it.
  }

  const coupon = await stripe.coupons.create({
    id: FOUNDING_COUPON_ID,
    amount_off: FOUNDING_DISCOUNT_CENTS,
    currency: 'eur',
    duration: 'repeating',
    duration_in_months: 6,
    name: 'Precio de fundador (6 meses)',
  })
  return coupon.id
}

export function getFoundingCouponId(): Promise<string> {
  if (!foundingCouponIdPromise) {
    foundingCouponIdPromise = loadOrCreateFoundingCoupon()
  }
  return foundingCouponIdPromise
}

// A single manual switch (see the Fase 5 pricing decision) rather than a
// per-restaurant setting — while true, every NEW subscription gets the
// founding coupon applied; flip it to 'false' in Vercel once there are
// real case studies to point to, and every restaurant that starts billing
// after that pays the standard 600€ price from day one, no discount.
export function isFoundingEraActive(): boolean {
  return process.env.FOUNDING_ERA_ACTIVE !== 'false'
}
