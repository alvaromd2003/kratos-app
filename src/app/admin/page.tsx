import Link from 'next/link'
import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/i18n/server'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

export default async function AdminHome() {
  const { restaurant } = await requireManagerRole()
  const supabase = await createClient()
  const t = staffDict[await getStaffLocale()]

  const [{ count: menuItemCount }, { count: tableCount }, { count: staffCount }] =
    await Promise.all([
      supabase
        .from('menu_items')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id),
      supabase
        .from('tables')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id),
      supabase
        .from('restaurant_users')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurant.id),
    ])

  const steps = [
    { label: t['home.stepMenu'], done: (menuItemCount ?? 0) > 0, href: '/admin/menu' },
    { label: t['home.stepTables'], done: (tableCount ?? 0) > 0, href: '/admin/tables' },
    {
      label: t['home.stepStripe'],
      done: restaurant.stripe_onboarding_complete,
      href: '/admin/settings',
    },
    { label: t['home.stepStaff'], done: (staffCount ?? 0) > 1, href: '/admin/staff' },
  ]
  const pendingSteps = steps.filter((s) => !s.done)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display text-ink">{restaurant.name}</h1>

      {pendingSteps.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-5">
          <h2 className="font-display text-lg text-ink">{t['home.firstSteps']}</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2.5">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                    step.done ? 'bg-sage-bg text-sage' : 'border border-marble-3 text-bronze'
                  }`}
                >
                  {step.done ? '✓' : ''}
                </span>
                {step.done ? (
                  <span className="text-bronze line-through">{step.label}</span>
                ) : (
                  <Link href={step.href} className="text-ink underline underline-offset-2">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-bronze">
        {t['home.helpBefore']}
        <Link href="/admin/help" className="text-ink underline underline-offset-2">
          {t['nav.help']}
        </Link>
        {t['home.helpAfter']}
      </p>
    </div>
  )
}
