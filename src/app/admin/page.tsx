import Link from 'next/link'
import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'

export default async function AdminHome() {
  const { restaurant } = await requireManagerRole()
  const supabase = await createClient()

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
    { label: 'Configura tu menú', done: (menuItemCount ?? 0) > 0, href: '/admin/menu' },
    { label: 'Añade tus mesas', done: (tableCount ?? 0) > 0, href: '/admin/tables' },
    {
      label: 'Conecta Stripe para cobrar',
      done: restaurant.stripe_onboarding_complete,
      href: '/admin/settings',
    },
    { label: 'Invita a tu personal', done: (staffCount ?? 0) > 1, href: '/admin/staff' },
  ]
  const pendingSteps = steps.filter((s) => !s.done)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display text-ink">{restaurant.name}</h1>

      {pendingSteps.length > 0 && (
        <section className="flex flex-col gap-2 rounded border border-gray-200 p-4">
          <h2 className="font-medium">Primeros pasos</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {steps.map((step) => (
              <li key={step.label} className="flex items-center gap-2">
                <span>{step.done ? '✓' : '○'}</span>
                {step.done ? (
                  <span className="text-gray-500 line-through">{step.label}</span>
                ) : (
                  <Link href={step.href} className="underline">
                    {step.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-gray-600">
        Usa el menú de arriba para gestionar tu carta o tus mesas. ¿Dudas sobre cómo configurar
        algo? Consulta la <Link href="/admin/help" className="underline">Ayuda</Link>.
      </p>
    </div>
  )
}
