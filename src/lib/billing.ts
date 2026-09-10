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
  // limit: 100 (Stripe's max) rather than 10 — this product should only
  // ever have a couple of prices, but a stray one left over from earlier
  // test-mode fiddling must still be seen, not silently missed past page 1.
  const prices = await stripe.prices.list({ product: KRATOS_BILLING_PRODUCT_ID, active: true, limit: 100 })
  const matches = prices.data.filter(
    (p) => p.unit_amount === STANDARD_PRICE_CENTS && p.currency === 'eur' && p.recurring?.interval === 'month'
  )
  if (matches.length === 0) {
    throw new Error('No se encontró el precio mensual de 600€ en el producto de Stripe.')
  }
  if (matches.length > 1) {
    // Silently picking Stripe's list order here risks quietly using a
    // stray duplicate price instead of the intended one — fail loudly
    // instead so this gets resolved by hand in the Stripe dashboard.
    throw new Error(
      `Hay ${matches.length} precios de 600€/mes activos en el producto de Stripe — archiva el que sobre antes de continuar.`
    )
  }
  return matches[0].id
}

export function getStandardPriceId(): Promise<string> {
  if (!standardPriceIdPromise) {
    // Reset on failure so a transient Stripe error doesn't permanently
    // poison this warm serverless instance — the next call gets a fresh
    // attempt instead of re-awaiting the same rejected promise forever.
    standardPriceIdPromise = loadStandardPriceId().catch((err) => {
      standardPriceIdPromise = null
      throw err
    })
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

  try {
    const coupon = await stripe.coupons.create({
      id: FOUNDING_COUPON_ID,
      amount_off: FOUNDING_DISCOUNT_CENTS,
      currency: 'eur',
      duration: 'repeating',
      duration_in_months: 6,
      name: 'Precio de fundador (6 meses)',
    })
    return coupon.id
  } catch {
    // Two concurrent first-ever calls (on different serverless instances)
    // can both reach here; whichever loses the create race just re-fetches
    // the one the winner just made, instead of surfacing a hard failure.
    const existing = await stripe.coupons.retrieve(FOUNDING_COUPON_ID)
    return existing.id
  }
}

export function getFoundingCouponId(): Promise<string> {
  if (!foundingCouponIdPromise) {
    foundingCouponIdPromise = loadOrCreateFoundingCoupon().catch((err) => {
      foundingCouponIdPromise = null
      throw err
    })
  }
  return foundingCouponIdPromise
}

// A single manual switch (see the Fase 5 pricing decision) rather than a
// per-restaurant setting — while true, every NEW subscription gets the
// founding coupon applied; flip it to 'false' in Vercel once there are
// real case studies to point to, and every restaurant that starts billing
// after that pays the standard 600€ price from day one, no discount.
export function isFoundingEraActive(): boolean {
  return process.env.FOUNDING_ERA_ACTIVE?.trim().toLowerCase() !== 'false'
}
