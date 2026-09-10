import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDateTime } from '@/lib/format'

// Kept outside the page component itself — the react-hooks/purity rule
// flags any Date.now()/new Date() call made directly inside a component
// function, even a Server Component that only ever runs once per request.
function trialStatus(trialEndsAt: string | null): { label: string; className: string } {
  if (!trialEndsAt) {
    return { label: 'Sin límite', className: 'text-bronze' }
  }
  const endsAt = new Date(trialEndsAt).getTime()
  const daysLeft = Math.ceil((endsAt - Date.now()) / (24 * 60 * 60 * 1000))
  if (daysLeft < 0) {
    return { label: 'Caducada', className: 'text-rust font-semibold' }
  }
  if (daysLeft <= 5) {
    return { label: `Quedan ${daysLeft}d`, className: 'text-ember font-semibold' }
  }
  return { label: `Activa (${daysLeft}d)`, className: 'text-sage' }
}

// Cross-restaurant overview for the platform owner only — never for
// restaurant staff, regardless of role. Gated by comparing the logged-in
// email against PLATFORM_ADMIN_EMAIL rather than any in-app role, since
// this has nothing to do with any single restaurant's own permissions.
export default async function PlatformOverviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const platformAdminEmail = process.env.PLATFORM_ADMIN_EMAIL
  if (!user || !platformAdminEmail || user.email !== platformAdminEmail) {
    redirect('/admin')
  }

  const admin = createAdminClient()

  const { data: restaurants } = await admin
    .from('restaurants')
    .select('id, name, created_at, trial_ends_at, stripe_onboarding_complete')
    .order('created_at', { ascending: false })

  const restaurantList = restaurants ?? []

  const rows = await Promise.all(
    restaurantList.map(async (r) => {
      const [{ data: owner }, { count: tableCount }, { count: itemCount }] = await Promise.all([
        admin
          .from('restaurant_users')
          .select('user_id')
          .eq('restaurant_id', r.id)
          .eq('role', 'owner')
          .limit(1)
          .maybeSingle(),
        admin.from('tables').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
        admin.from('menu_items').select('id', { count: 'exact', head: true }).eq('restaurant_id', r.id),
      ])

      let ownerEmail = '—'
      if (owner?.user_id) {
        const { data } = await admin.auth.admin.getUserById(owner.user_id)
        ownerEmail = data.user?.email ?? '—'
      }

      const trial = trialStatus(r.trial_ends_at)

      return {
        id: r.id,
        name: r.name,
        createdAt: r.created_at,
        ownerEmail,
        trialLabel: trial.label,
        trialClass: trial.className,
        stripeConnected: r.stripe_onboarding_complete,
        tableCount: tableCount ?? 0,
        itemCount: itemCount ?? 0,
      }
    })
  )

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display text-ink">Panel de restaurantes ({rows.length})</h1>

      <div className="overflow-x-auto rounded-xl border border-marble-3 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-marble-3 text-left text-xs font-semibold uppercase tracking-wide text-bronze">
              <th className="px-4 py-3">Restaurante</th>
              <th className="px-4 py-3">Creado</th>
              <th className="px-4 py-3">Prueba</th>
              <th className="px-4 py-3">Stripe</th>
              <th className="px-4 py-3">Dueño</th>
              <th className="px-4 py-3">Mesas</th>
              <th className="px-4 py-3">Platos</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-marble-3 last:border-0">
                <td className="px-4 py-3 font-medium text-ink">{r.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-bronze">{formatDateTime(r.createdAt)}</td>
                <td className={`px-4 py-3 ${r.trialClass}`}>{r.trialLabel}</td>
                <td className="px-4 py-3">
                  {r.stripeConnected ? (
                    <span className="text-sage">Conectado</span>
                  ) : (
                    <span className="text-bronze">No conectado</span>
                  )}
                </td>
                <td className="px-4 py-3 text-bronze">{r.ownerEmail}</td>
                <td className="px-4 py-3 font-mono text-ink">{r.tableCount}</td>
                <td className="px-4 py-3 font-mono text-ink">{r.itemCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-4 text-sm text-bronze">Todavía no hay restaurantes.</p>}
      </div>
    </div>
  )
}
