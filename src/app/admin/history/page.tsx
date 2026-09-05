import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { formatPrice, formatDateTime } from '@/lib/format'

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista',
  delivered: 'Entregada',
}

const PAGE_SIZE = 50

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>
}) {
  const { restaurant } = await requireManagerRole()
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
        <h1 className="text-xl font-semibold">Historial de pedidos — {restaurant.name}</h1>
        {(orders.length > 0 || before) && (
          <a
            href="/admin/history/export"
            className="rounded border border-gray-300 px-3 py-1.5 text-sm underline"
          >
            Exportar CSV
          </a>
        )}
      </div>

      {orders.length === 0 ? (
        <p className="text-gray-600">
          {before ? 'No hay más pedidos.' : 'Todavía no se ha enviado ningún pedido.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => {
            const total = order.items.reduce(
              (sum, item) => sum + item.priceCents * item.quantity,
              0
            )
            return (
              <li key={order.id} className="flex flex-col gap-2 rounded border border-gray-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">Mesa {order.tableLabel}</p>
                    <p className="text-xs text-gray-500">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{STATUS_LABEL[order.status]}</p>
                    <p className="text-sm font-semibold">{formatPrice(total, restaurant.currency)}</p>
                  </div>
                </div>
                <ul className="text-sm text-gray-700">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.dishName}{' '}
                      <span className="text-gray-500">— {item.participantName}</span>
                      {item.note && <span className="text-gray-500"> ({item.note})</span>}
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
          className="self-start rounded border border-gray-300 px-4 py-2 text-sm underline"
        >
          Cargar más
        </a>
      )}
    </div>
  )
}
