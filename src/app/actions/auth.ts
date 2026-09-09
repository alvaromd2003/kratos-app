'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthFormState = { error?: string } | undefined

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const accessCode = String(formData.get('access_code') ?? '').trim()

  if (!email || !password) {
    return { error: 'Introduce un email y una contraseña.' }
  }
  if (password.length < 8) {
    return { error: 'La contraseña debe tener al menos 8 caracteres.' }
  }
  if (!accessCode) {
    return { error: 'Introduce el código de acceso.' }
  }

  // Keeps /signup from being wide open to anyone who finds the URL — only
  // people Kratos has actually given a code to can create an account.
  // Checked with the service-role client, not the RLS-bound one: nobody
  // is authenticated yet at this point, and access_codes has no RLS
  // policies on purpose (same reasoning as loyalty_accounts) so an unused
  // code can never be enumerated/brute-forced via the anon key.
  const admin = createAdminClient()
  const { data: codeRow } = await admin
    .from('access_codes')
    .select('id, is_generic, used_at')
    .eq('code', accessCode)
    .maybeSingle()

  if (!codeRow) {
    return { error: 'Código de acceso incorrecto.' }
  }
  if (!codeRow.is_generic && codeRow.used_at) {
    return { error: 'Este código de acceso ya se ha utilizado.' }
  }

  const supabase = await createClient()
  // Carried in the auth user's own metadata so createRestaurant (a
  // separate step, once they confirm their email and log back in) can
  // later look the same code back up — specifically to know whether it
  // was the generic testing code, which should never start a trial
  // countdown on what it creates.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { signup_access_code: accessCode } },
  })

  if (error) {
    return { error: error.message }
  }

  // Single-use codes are consumed now, not when onboarding finishes —
  // simpler than tracking a half-finished signup, at the cost of a code
  // being "spent" if someone abandons right after this step (generating
  // another one is cheap, so this trade-off is fine).
  if (!codeRow.is_generic) {
    await admin
      .from('access_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', codeRow.id)
  }

  redirect('/signup/check-email')
}

export async function login(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return { error: 'Email o contraseña incorrectos.' }
  }

  redirect('/admin')
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) {
    return { error: 'Introduce tu email.' }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: 'https://order.kratosystems.com/reset-password',
  })

  // Always show the same message, whether or not the email exists —
  // otherwise this becomes a way to check which emails are registered.
  redirect('/forgot-password/check-email')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
