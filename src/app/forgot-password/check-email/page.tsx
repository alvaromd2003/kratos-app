import { AuthHeader } from '@/app/auth-header'
import { AuthLocaleShell } from '@/app/auth-locale-shell'
import { StaffLanguageSwitcher } from '@/app/admin/staff-language-switcher'
import { getStaffLocale } from '@/lib/i18n/server'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

export default async function ForgotPasswordCheckEmailPage() {
  const t = staffDict[await getStaffLocale()]

  return (
    <AuthLocaleShell>
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <AuthHeader />
            <StaffLanguageSwitcher />
          </div>
          <div className="flex w-full flex-col gap-4">
            <h1 className="text-2xl font-display text-white">{t['auth.checkEmailTitle']}</h1>
            <p className="text-cream-dim">
              {t['auth.forgotCheckEmailBody']}
            </p>
          </div>
        </main>
      </div>
    </AuthLocaleShell>
  )
}
