import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { formatPrice, formatDateTime } from '@/lib/format'
import { getStaffLocale } from '@/lib/i18n/server'
import { interpolate } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

const PAGE_SIZE = 50

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>
}) {
  const { restaurant } = await requireManagerRole()
  const t = staffDict[await getStaffLocale()]
  const { before } = await searchParams

  const supabase = await createClient()
  // Fetch one extra to know whether there's a next page without a
  // separate count query.
  const fetched = await getRestaurantOrders(supabase, restaurant.id, {
    before,
    limit: PAGE_SIZE + 1,
  })
  const orders = fetched.slice(0, PAGE_SIZE)
  const nextCursor = fetched.length > PAGE_SIZE ? orders[orders.length - 1].createdAt : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-display text-ink">{interpolate(t['history.title'], { name: restaurant.name })}</h1>
        {(orders.length > 0 || before) && (
          <a
            href="/admin/history/export"
            className="rounded-lg border border-marble-3 px-3 py-1.5 text-sm text-bronze underline"
          >
            {t['history.exportCsv']}
          </a>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-bronze">
          {before ? t['history.noMoreOrders'] : t['history.noOrdersYet']}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => {
            const total = order.items.reduce(
              (sum, item) => sum + item.priceCents * item.quantity,
              0
            )
            return (
              <li
                key={order.id}
                className="flex flex-col gap-2 rounded-xl border border-marble-3 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-ink">{interpolate(t['common.table'], { label: order.tableLabel })}</p>
                    <p className="font-mono text-xs text-bronze">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-bronze">{t[`orderStatus.${order.status}`]}</p>
                    <p className="font-mono text-sm font-semibold text-ink">
                      {formatPrice(total, restaurant.currency)}
                    </p>
                  </div>
                </div>
                <ul className="text-sm text-bronze">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.dishName}{' '}
                      <span className="text-bronze/80">— {item.participantName}</span>
                      {item.note && <span className="text-bronze/80"> ({item.note})</span>}
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
      )}

      {nextCursor && (
        <a
          href={`/admin/history?before=${encodeURIComponent(nextCursor)}`}
          className="self-start rounded-lg border border-marble-3 px-4 py-2 text-sm text-bronze underline"
        >
          {t['history.loadMore']}
        </a>
      )}
    </div>
  )
}
