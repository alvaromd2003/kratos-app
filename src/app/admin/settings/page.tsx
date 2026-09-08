import { redirect } from 'next/navigation'
import { requireManagerRole } from '@/lib/restaurant'
import { syncStripeOnboardingStatus } from '@/app/actions/stripe-connect'
import { getRequestOrigin } from '@/lib/payments'
import { stripe } from '@/lib/stripe'
import { SettingsForm } from './settings-form'
import { StripeConnectSection } from './stripe-connect-section'

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ stripe?: string }>
}) {
  const { restaurant } = await requireManagerRole()
  const { stripe: stripeReturn } = await searchParams

  let onboardingComplete = restaurant.stripe_onboarding_complete

  // Onboarding link expired mid-way — Stripe sends the owner back here so
  // we can hand them a fresh one instead of a dead end.
  if (stripeReturn === 'refresh' && restaurant.stripe_account_id) {
    const origin = await getRequestOrigin()
    const link = await stripe.accountLinks.create({
      account: restaurant.stripe_account_id,
      type: 'account_onboarding',
      refresh_url: `${origin}/admin/settings?stripe=refresh`,
      return_url: `${origin}/admin/settings?stripe=return`,
    })
    redirect(link.url)
  }

  // Owner finished (or gave up on) the Stripe-hosted onboarding — status
  // must be re-checked against Stripe's API, never trusted from the
  // redirect alone.
  if (stripeReturn === 'return' && restaurant.stripe_account_id && !onboardingComplete) {
    onboardingComplete = await syncStripeOnboardingStatus(restaurant.id, restaurant.stripe_account_id)
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-display text-ink">Ajustes — {restaurant.name}</h1>
      <SettingsForm
        name={restaurant.name}
        currency={restaurant.currency}
        enabledDietaryTags={restaurant.enabled_dietary_tags}
        enabledPaymentMethods={restaurant.enabled_payment_methods}
        googleReviewUrl={restaurant.google_review_url}
      />
      <StripeConnectSection connected={onboardingComplete} />
    </div>
  )
}
