import 'server-only'
import Stripe from 'stripe'

// Lazily constructed: a plain `new Stripe(...)` at module scope would run
// (and throw on a missing key) the moment ANY route that imports this file
// gets bundled during `next build` — not just when a payment actually
// happens. The proxy defers that until the first real call, at runtime.
let instance: Stripe | undefined

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    if (!instance) {
      instance = new Stripe(process.env.STRIPE_SECRET_KEY!)
    }
    return Reflect.get(instance, prop, instance)
  },
})
