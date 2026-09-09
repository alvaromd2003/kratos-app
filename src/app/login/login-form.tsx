'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'
import { useLocale } from '@/lib/i18n/provider'
import { StaffLanguageSwitcher } from '@/app/admin/staff-language-switcher'

export function LoginForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4">
        <AuthHeader />
        <StaffLanguageSwitcher />
      </div>
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-display text-white">{t('auth.loginTitle')}</h1>
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
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? t('auth.loggingIn') : t('auth.login')}
        </button>
      </form>
      <p className="text-sm text-cream-dim">
        <Link href="/forgot-password" className="underline">
          {t('auth.forgotPassword')}
        </Link>
      </p>
      <p className="text-sm text-cream-dim">
        {t('auth.noAccount')}{' '}
        <Link href="/signup" className="underline">
          {t('auth.signupLink')}
        </Link>
      </p>
      </div>
      </main>
    </div>
  )
}
