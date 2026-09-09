import { getStaffLocale } from '@/lib/i18n/server'
import { dirFor } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'
import { LocaleProvider } from '@/lib/i18n/provider'

// Wraps every pre-login page (login/signup/password recovery) with the same
// staff locale used inside /admin — so a staff member's language choice
// carries across logging out and back in, and vice versa a choice made
// here (before they've ever seen /admin) sticks once they do. No visual
// markup of its own (each page places its own <StaffLanguageSwitcher />
// inside its themed container) — this only sets dir/lang and the Context.
export async function AuthLocaleShell({ children }: { children: React.ReactNode }) {
  const locale = await getStaffLocale()

  return (
    <div dir={dirFor(locale)} lang={locale}>
      <LocaleProvider locale={locale} dict={staffDict[locale]}>
        {children}
      </LocaleProvider>
    </div>
  )
}
