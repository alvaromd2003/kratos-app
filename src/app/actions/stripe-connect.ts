'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { getRequestOrigin } from '@/lib/payments'
import { stripe } from '@/lib/stripe'

export type StripeConnectFormState = { error?: string } | undefined

// Creates the restaurant's Stripe Express account on first use (Kratos is
// the platform; the restaurant is the connected account funds settle to),
// then always generates a fresh onboarding link and sends the owner there
// — needed both the first time and to resume an interrupted onboarding.
export async function startStripeOnboarding(): Promise<StripeConnectFormState> {
  const { user, restaurant } = await getCurrentRestaurant()
  const origin = await getRequestOrigin()

  let accountId = restaurant.stripe_account_id

  if (!accountId) {
    let account
    try {
      account = await stripe.accounts.create({
        type: 'express',
        email: user.email ?? undefined,
      })
    } catch {
      return { error: 'No se pudo crear la cuenta de Stripe. Inténtalo de nuevo.' }
    }
    accountId = account.id

    const supabase = await createClient()
    const { error } = await supabase
      .from('restaurants')
      .update({ stripe_account_id: accountId })
      .eq('id', restaurant.id)
    if (error) {
      return { error: 'No se pudo guardar la cuenta de Stripe. Inténtalo de nuevo.' }
    }
  }

  let link
  try {
    link = await stripe.accountLinks.create({
      account: accountId,
      type: 'account_onboarding',
      refresh_url: `${origin}/admin/settings?stripe=refresh`,
      return_url: `${origin}/admin/settings?stripe=return`,
    })
  } catch {
    return { error: 'No se pudo iniciar la conexión con Stripe. Inténtalo de nuevo.' }
  }

  revalidatePath('/admin/settings')
  redirect(link.url)
}

// Called from the settings page itself when Stripe bounces the owner back
// (?stripe=return) — Express onboarding status must be re-checked against
// Stripe's API rather than trusted from the redirect alone.
export async function syncStripeOnboardingStatus(restaurantId: string, stripeAccountId: string) {
  const account = await stripe.accounts.retrieve(stripeAccountId)
  const complete = Boolean(account.details_submitted && account.charges_enabled)

  if (complete) {
    const supabase = await createClient()
    await supabase
      .from('restaurants')
      .update({ stripe_onboarding_complete: true })
      .eq('id', restaurantId)
  }

  return complete
}

export async function openStripeDashboard(): Promise<StripeConnectFormState> {
  const { restaurant } = await getCurrentRestaurant()
  if (!restaurant.stripe_account_id) {
    return { error: 'Todavía no has conectado una cuenta de Stripe.' }
  }

  let link
  try {
    link = await stripe.accounts.createLoginLink(restaurant.stripe_account_id)
  } catch {
    return { error: 'No se pudo abrir el panel de Stripe. Inténtalo de nuevo.' }
  }

  redirect(link.url)
}
