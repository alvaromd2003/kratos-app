import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { formatPrice } from '@/lib/format'
import { daysAgoIso } from '@/lib/timezone'

const RANGES = [
  { value: '7', label: '7 días', days: 7 },
  { value: '30', label: '30 días', days: 30 },
  { value: '90', label: '90 días', days: 90 },
  { value: 'all', label: 'Todo', days: null },
] as const

function madridHour(isoDate: string): number {
  return Number(
    new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hour: '2-digit', hour12: false }).format(
      new Date(isoDate)
    )
  ) % 24
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>
}) {
  const { restaurant } = await requireManagerRole()
  const { range: rangeParam } = await searchParams

  const range = RANGES.find((r) => r.value === rangeParam) ?? RANGES[1]
  const since = range.days ? daysAgoIso(range.days) : undefined

  const supabase = await createClient()
  const orders = await getRestaurantOrders(supabase, restaurant.id, { since })

  // session_participants has no restaurant_id of its own — filtered via
  // its table_session's restaurant_id instead, same join Postgres RLS
  // itself uses to scope staff access to this table.
  let feedbackQuery = supabase
    .from('session_participants')
    .select('feedback_rating, table_sessions!inner(restaurant_id)')
    .eq('table_sessions.restaurant_id', restaurant.id)
    .not('feedback_rating', 'is', null)
  if (since) {
    feedbackQuery = feedbackQuery.gte('feedback_submitted_at', since)
  }
  const { data: feedbackRows } = await feedbackQuery

  const ratings = (feedbackRows ?? []).map((r) => r.feedback_rating as number)
  const averageRating = ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
  const lowRatingCount = ratings.filter((r) => r <= 3).length

  const rangeSelector = (
    <div className="flex gap-2">
      {RANGES.map((r) => (
        <a
          key={r.value}
          href={`/admin/stats?range=${r.value}`}
          className={`rounded-full border px-3 py-1 text-xs ${
            r.value === range.value ? 'border-ember bg-ember text-ink' : 'border-marble-3 text-bronze'
          }`}
        >
          {r.label}
        </a>
      ))}
    </div>
  )

  if (orders.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-display text-ink">Estadísticas — {restaurant.name}</h1>
          {rangeSelector}
        </div>
        <p className="text-bronze">No hay pedidos en este rango de fechas.</p>
      </div>
    )
  }

  let totalRevenue = 0
  const soldByDish = new Map<string, { name: string; quantity: number; revenue: number }>()
  const ordersByHour = new Map<number, number>()

  for (const order of orders) {
    const hour = madridHour(order.createdAt)
    ordersByHour.set(hour, (ordersByHour.get(hour) ?? 0) + 1)
    for (const item of order.items) {
      const lineRevenue = item.priceCents * item.quantity
      totalRevenue += lineRevenue

      const existing = soldByDish.get(item.dishName)
      if (existing) {
        existing.quantity += item.quantity
        existing.revenue += lineRevenue
      } else {
        soldByDish.set(item.dishName, { name: item.dishName, quantity: item.quantity, revenue: lineRevenue })
      }
    }
  }

  const topDishes = [...soldByDish.values()].sort((a, b) => b.quantity - a.quantity).slice(0, 5)

  let busiestHour: number | null = null
  let busiestHourCount = 0
  for (const [hour, count] of ordersByHour) {
    if (count > busiestHourCount) {
      busiestHour = hour
      busiestHourCount = count
    }
  }

  const averageTicket = totalRevenue / orders.length

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-display text-ink">Estadísticas — {restaurant.name}</h1>
        {rangeSelector}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-marble-3 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">Ingresos totales</p>
          <p className="mt-1 font-mono text-2xl text-ink">
            {formatPrice(totalRevenue, restaurant.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-marble-3 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">
            Ticket medio por pedido
          </p>
          <p className="mt-1 font-mono text-2xl text-ink">
            {formatPrice(averageTicket, restaurant.currency)}
          </p>
        </div>
        <div className="rounded-xl border border-marble-3 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">Hora punta</p>
          <p className="mt-1 font-mono text-2xl text-ink">
            {busiestHour !== null ? `${busiestHour}:00–${busiestHour + 1}:00` : '—'}
          </p>
        </div>
        <div className="rounded-xl border border-marble-3 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-bronze">
            Valoración media
          </p>
          <p className="mt-1 font-mono text-2xl text-ink">
            {averageRating !== null ? `${averageRating.toFixed(1)}★` : '—'}
          </p>
          {ratings.length > 0 && (
            <p className="mt-0.5 text-xs text-bronze">
              {ratings.length} valoraciones
              {lowRatingCount > 0 && `, ${lowRatingCount} de 3★ o menos`}
            </p>
          )}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">Platos más vendidos</h2>
        <ul className="flex flex-col gap-2">
          {topDishes.map((dish) => (
            <li
              key={dish.name}
              className="flex items-center justify-between rounded-xl border border-marble-3 bg-white p-4 text-sm"
            >
              <span className="text-ink">{dish.name}</span>
              <span className="font-mono text-bronze">
                {dish.quantity} vendidos — {formatPrice(dish.revenue, restaurant.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
