'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'
import { useLocale } from '@/lib/i18n/provider'
import { StaffLanguageSwitcher } from '@/app/admin/staff-language-switcher'

export function SignupForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4">
        <AuthHeader />
        <StaffLanguageSwitcher />
      </div>
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-display text-white">{t('auth.signupTitle')}</h1>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-cream-dim">
            {t('auth.email')}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-cream-dim">
            {t('auth.password')}
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
          <span className="text-xs text-cream-dim">{t('auth.passwordMinHint')}</span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="access_code" className="text-sm text-cream-dim">
            {t('auth.accessCode')}
          </label>
          <input
            id="access_code"
            name="access_code"
            type="text"
            required
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
          <span className="text-xs text-cream-dim">
            {t('auth.accessCodeHint')}
          </span>
        </div>
        <label className="flex items-start gap-2 text-sm text-cream-dim">
          <input
            name="accepted_terms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-ember"
          />
          <span>
            {t('auth.termsPrefix')}
            <Link href="/terminos" target="_blank" className="underline">
              {t('auth.termsLink')}
            </Link>
            {t('auth.termsMiddle1')}
            <Link href="/privacidad" target="_blank" className="underline">
              {t('auth.privacyLink')}
            </Link>
            {t('auth.termsMiddle2')}
            <Link href="/tratamiento-datos" target="_blank" className="underline">
              {t('auth.dataProcessingLink')}
            </Link>
            {t('auth.termsSuffix')}
          </span>
        </label>
        {state?.errorCode && (
          <p className="text-sm text-rust">
            {t(`error.${state.errorCode}`, state.errorMessage ? { message: state.errorMessage } : undefined)}
          </p>
        )}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? t('auth.creatingAccount') : t('auth.createAccount')}
        </button>
      </form>
      <p className="text-sm text-cream-dim">
        {t('auth.alreadyHaveAccount')}{' '}
        <Link href="/login" className="underline">
          {t('auth.loginLink')}
        </Link>
      </p>
      </div>
      </main>
    </div>
  )
}
