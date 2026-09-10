import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { getStaffLocale } from '@/lib/i18n/server'
import { dirFor } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'
import { LocaleProvider } from '@/lib/i18n/provider'
import { isPlatformAdminEmail } from '@/lib/platform-admin'
import { AdminNav } from './admin-nav'
import { StaffLanguageSwitcher } from './staff-language-switcher'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const locale = await getStaffLocale()

  // Best-effort only — no redirect here even if there's no membership yet,
  // since this layout also wraps /admin/onboarding itself.
  const { data: membership } = await supabase
    .from('restaurant_users')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const role = membership?.role

  // Each operational role gets exactly one screen — the one matching what
  // that job actually does. Owner/admin see everything.
  const homeHref = role === 'kitchen_staff' ? '/admin/kitchen' : role === 'waiter' ? '/admin/floor' : '/admin'
  const dict = staffDict[locale]
  const isPlatformAdmin = isPlatformAdminEmail(user.email)

  return (
    <div dir={dirFor(locale)} lang={locale} className="min-h-screen bg-marble">
      <LocaleProvider locale={locale} dict={dict}>
        <header className="bg-gradient-to-b from-ink to-ink-2 print:hidden">
          <div className="flex items-center justify-between gap-4 px-6 py-3">
            <Link href={homeHref} className="flex items-center">
              <Image
                src="/kratos-mark-light.png"
                alt="Kratos"
                width={743}
                height={338}
                priority
                className="h-6 w-auto"
              />
            </Link>
            <div className="flex items-center gap-4">
              <a
                href="mailto:hola@kratosystems.com"
                className="hidden text-sm text-cream-dim underline hover:text-marble-2 sm:inline"
                title={dict['nav.support']}
              >
                {dict['nav.support']}
              </a>
              <StaffLanguageSwitcher />
              <form action={logout}>
                <button type="submit" className="text-sm text-cream-dim underline hover:text-marble-2">
                  {dict['nav.logout']}
                </button>
              </form>
            </div>
          </div>
          <AdminNav role={role} isPlatformAdmin={isPlatformAdmin} />
        </header>
        <main className="p-6 print:p-0">{children}</main>
      </LocaleProvider>
    </div>
  )
}
