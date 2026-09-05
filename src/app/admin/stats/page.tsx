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

  const rangeSelector = (
    <div className="flex gap-2">
      {RANGES.map((r) => (
        <a
          key={r.value}
          href={`/admin/stats?range=${r.value}`}
          className={`rounded-full border px-3 py-1 text-xs ${
            r.value === range.value ? 'border-black bg-black text-white' : 'border-gray-300 text-gray-700'
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
          <h1 className="text-xl font-semibold">Estadísticas — {restaurant.name}</h1>
          {rangeSelector}
        </div>
        <p className="text-gray-600">No hay pedidos en este rango de fechas.</p>
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
        <h1 className="text-xl font-semibold">Estadísticas — {restaurant.name}</h1>
        {rangeSelector}
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Ingresos totales</p>
          <p className="text-lg font-semibold">{formatPrice(totalRevenue, restaurant.currency)}</p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Ticket medio por pedido</p>
          <p className="text-lg font-semibold">{formatPrice(averageTicket, restaurant.currency)}</p>
        </div>
        <div className="rounded border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Hora punta</p>
          <p className="text-lg font-semibold">
            {busiestHour !== null ? `${busiestHour}:00 - ${busiestHour + 1}:00` : '—'}
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Platos más vendidos</h2>
        <ul className="flex flex-col gap-2">
          {topDishes.map((dish) => (
            <li
              key={dish.name}
              className="flex items-center justify-between rounded border border-gray-200 p-3 text-sm"
            >
              <span>{dish.name}</span>
              <span className="text-gray-600">
                {dish.quantity} vendidos — {formatPrice(dish.revenue, restaurant.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
