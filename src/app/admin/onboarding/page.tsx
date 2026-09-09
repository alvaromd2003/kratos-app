import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OnboardingForm } from './onboarding-form'

export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership, error } = await supabase
    .from('restaurant_users')
    .select('restaurant_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  // A real query failure must not look like "no restaurant yet" — that
  // would show the create-restaurant form to someone who already has one,
  // risking a duplicate.
  if (error) {
    throw new Error(`No se pudo comprobar tu restaurante: ${error.message}`)
  }

  if (membership) {
    redirect('/admin')
  }

  // Accounts created before the access-code gate existed (or one whose
  // restaurant was later deleted) have no signup_access_code in their
  // metadata — without this, they could create a restaurant for free
  // with no code at all, bypassing the gate entirely.
  const needsAccessCode = !user.user_metadata?.signup_access_code

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-4 text-2xl font-display text-ink">Crea tu restaurante</h1>
      <OnboardingForm needsAccessCode={needsAccessCode} />
    </div>
  )
}
