'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export type AuthFormState = { errorCode?: string; errorMessage?: string } | undefined

export async function signup(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  const password = String(formData.get('password') ?? '')
  const accessCode = String(formData.get('access_code') ?? '').trim()
  const acceptedTerms = formData.get('accepted_terms') === 'on'

  if (!email || !password) {
    return { errorCode: 'EMPTY_EMAIL_PASSWORD' }
  }
  if (password.length < 8) {
    return { errorCode: 'PASSWORD_TOO_SHORT' }
  }
  if (!accessCode) {
    return { errorCode: 'ENTER_ACCESS_CODE' }
  }
  if (!acceptedTerms) {
    return { errorCode: 'MUST_ACCEPT_TERMS' }
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
    return { errorCode: 'INVALID_ACCESS_CODE' }
  }
  if (!codeRow.is_generic && codeRow.used_at) {
    return { errorCode: 'ACCESS_CODE_USED' }
  }

  // Claimed atomically now (the `is('used_at', null)` makes this a single
  // conditional UPDATE, not a separate check-then-write) rather than after
  // signUp() — two people submitting the same shareable code+link at once
  // previously both had a window to pass the check above before either
  // committed the update. Only one concurrent request can win this claim.
  if (!codeRow.is_generic) {
    const { data: claimed } = await admin
      .from('access_codes')
      .update({ used_at: new Date().toISOString() })
      .eq('id', codeRow.id)
      .is('used_at', null)
      .select('id')
      .maybeSingle()
    if (!claimed) {
      return { errorCode: 'ACCESS_CODE_USED' }
    }
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
    options: {
      data: {
        signup_access_code: accessCode,
        // Kept as a record of consent — when, not just that.
        terms_accepted_at: new Date().toISOString(),
      },
    },
  })

  if (error) {
    return { errorCode: 'SIGNUP_FAILED' }
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
    return { errorCode: 'INVALID_LOGIN' }
  }

  redirect('/admin')
}

export async function requestPasswordReset(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const email = String(formData.get('email') ?? '').trim()
  if (!email) {
    return { errorCode: 'EMPTY_EMAIL' }
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
