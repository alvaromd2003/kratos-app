import 'server-only'
import { stripe } from '@/lib/stripe'

// The one Stripe product covering Kratos's own subscription to restaurants
// (distinct from each restaurant's own Connect account used for diner
// payments) — created once in the Stripe dashboard, "Kratos — Suscripción
// mensual", with two recurring monthly EUR prices attached: 350€ and 600€.
const KRATOS_BILLING_PRODUCT_ID = 'prod_VELIC4TelO68zQ'
const FOUNDING_PRICE_CENTS = 35000
const STANDARD_PRICE_CENTS = 60000

let pricesPromise: Promise<{ foundingPriceId: string; standardPriceId: string }> | null = null

// Looked up by amount rather than a hardcoded price ID — avoids needing to
// copy IDs out of the Stripe dashboard by hand, and works the same way
// whether the product lives in test or live mode.
async function loadPrices() {
  const prices = await stripe.prices.list({ product: KRATOS_BILLING_PRODUCT_ID, active: true, limit: 10 })

  const founding = prices.data.find((p) => p.unit_amount === FOUNDING_PRICE_CENTS && p.currency === 'eur')
  const standard = prices.data.find((p) => p.unit_amount === STANDARD_PRICE_CENTS && p.currency === 'eur')

  if (!founding || !standard) {
    throw new Error('No se encontraron los precios 350€/600€ en el producto de Stripe.')
  }

  return { foundingPriceId: founding.id, standardPriceId: standard.id }
}

export function getBillingPrices() {
  if (!pricesPromise) {
    pricesPromise = loadPrices()
  }
  return pricesPromise
}

// A single manual switch (see the Fase 5 pricing decision) rather than a
// per-restaurant setting — while true, every NEW subscription starts on
// the discounted founding price and gets the 6-month step-up; flip it to
// 'false' in Vercel once there are real case studies to point to, and every
// restaurant that starts billing after that goes straight to the standard
// price with no step-up at all.
export function isFoundingEraActive(): boolean {
  return process.env.FOUNDING_ERA_ACTIVE !== 'false'
}
