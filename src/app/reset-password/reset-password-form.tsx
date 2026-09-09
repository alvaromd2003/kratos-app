'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader } from '@/app/auth-header'
import { useLocale } from '@/lib/i18n/provider'
import { StaffLanguageSwitcher } from '@/app/admin/staff-language-switcher'

export function ResetPasswordForm() {
  const { t } = useLocale()
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [errorCode, setErrorCode] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    // The recovery link puts a temporary session in the URL; the browser
    // client picks it up automatically on load. We just wait for it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorCode(null)

    if (password.length < 8) {
      setErrorCode('PASSWORD_TOO_SHORT')
      return
    }
    if (password !== confirmPassword) {
      setErrorCode('PASSWORDS_DONT_MATCH')
      return
    }

    setPending(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPending(false)

    if (updateError) {
      setErrorCode('COULD_NOT_RESET_PASSWORD')
      return
    }

    router.push('/admin')
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <AuthHeader />
            <StaffLanguageSwitcher />
          </div>
          <div className="flex w-full flex-col gap-4">
            <h1 className="text-2xl font-display text-white">{t('auth.resetInvalidTitle')}</h1>
            <p className="text-cream-dim">
              {t('auth.resetInvalidBody')}
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4">
        <AuthHeader />
        <StaffLanguageSwitcher />
      </div>
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-display text-white">{t('auth.resetTitle')}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-cream-dim">
            {t('auth.newPassword')}
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-password" className="text-sm text-cream-dim">
            {t('auth.repeatPassword')}
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        {errorCode && <p className="text-sm text-rust">{t(`error.${errorCode}`)}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? t('common.saving') : t('auth.savePassword')}
        </button>
      </form>
      </div>
      </main>
    </div>
  )
}
