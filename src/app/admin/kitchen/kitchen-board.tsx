'use client'

import { useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatTime } from '@/lib/format'
import { updateOrderStatus } from '@/app/actions/kitchen'
import type { OrderDetail } from '@/lib/orders'

type OrderStatus = OrderDetail['status']
type OrderRow = { id: string; table_session_id: string; status: OrderStatus; created_at: string }

const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'delivered',
  delivered: null,
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista',
  delivered: 'Entregada',
}

async function loadFullOrder(
  supabase: ReturnType<typeof createClient>,
  row: OrderRow
): Promise<OrderDetail | null> {
  const { data: session } = await supabase
    .from('table_sessions')
    .select('table_id')
    .eq('id', row.table_session_id)
    .maybeSingle()
  if (!session) return null

  const { data: table } = await supabase
    .from('tables')
    .select('label')
    .eq('id', session.table_id)
    .maybeSingle()

  const { data: items } = await supabase
    .from('order_items')
    .select('id, quantity, menu_item_id, participant_id')
    .eq('order_id', row.id)

  const itemList = items ?? []
  const menuItemIds = [...new Set(itemList.map((i) => i.menu_item_id))]
  const participantIds = [...new Set(itemList.map((i) => i.participant_id))]

  const [{ data: menuItems }, { data: participants }] = await Promise.all([
    menuItemIds.length > 0
      ? supabase.from('menu_items').select('id, name, price_cents').in('id', menuItemIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase.from('session_participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] }),
  ])

  const menuItemById = new Map((menuItems ?? []).map((m) => [m.id, m]))
  const participantNameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    tableLabel: table?.label ?? '—',
    items: itemList.map((item) => {
      const menuItem = menuItemById.get(item.menu_item_id)
      return {
        id: item.id,
        quantity: item.quantity,
        dishName: menuItem?.name ?? '—',
        priceCents: menuItem?.price_cents ?? 0,
        participantName: participantNameById.get(item.participant_id) ?? '—',
      }
    }),
  }
}

export function KitchenBoard({
  restaurantId,
  currency,
  initialOrders,
  initialDeliveredToday,
}: {
  restaurantId: string
  currency: string
  initialOrders: OrderDetail[]
  initialDeliveredToday: OrderDetail[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const [deliveredToday, setDeliveredToday] = useState(initialDeliveredToday)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`kitchen-${restaurantId}`)
      .on<OrderRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload: RealtimePostgresChangesPayload<OrderRow>) => {
          const row = payload.new as OrderRow
          const full = await loadFullOrder(supabase, row)
          if (!full) return
          setOrders((current) =>
            current.some((o) => o.id === full.id) ? current : [...current, full]
          )
        }
      )
      .on<OrderRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        async (payload) => {
          const row = payload.new as OrderRow
          if (row.status === 'delivered') {
            setOrders((current) => current.filter((o) => o.id !== row.id))
            const full = await loadFullOrder(supabase, row)
            if (full) {
              setDeliveredToday((current) =>
                current.some((o) => o.id === full.id) ? current : [full, ...current]
              )
            }
            return
          }
          setOrders((current) =>
            current.map((o) => (o.id === row.id ? { ...o, status: row.status } : o))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return (
    <div className="flex flex-col gap-6">
      {orders.length === 0 ? (
        <p className="text-gray-600">No hay pedidos pendientes ahora mismo.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-3 rounded border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Mesa {order.tableLabel}</h2>
                <span className="text-xs text-gray-500">{STATUS_LABEL[order.status]}</span>
              </div>
              <ul className="flex flex-col gap-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.dishName}{' '}
                    <span className="text-gray-500">— {item.participantName}</span>
                  </li>
                ))}
              </ul>
              {NEXT_STATUS[order.status] && (
                <form action={updateOrderStatus}>
                  <input type="hidden" name="id" value={order.id} />
                  <input type="hidden" name="status" value={NEXT_STATUS[order.status]!} />
                  <button type="submit" className="rounded bg-black px-3 py-1 text-xs text-white">
                    Marcar como {STATUS_LABEL[NEXT_STATUS[order.status]!].toLowerCase()}
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <details className="rounded border border-gray-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">
          Entregados hoy ({deliveredToday.length})
        </summary>
        {deliveredToday.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Todavía no se ha entregado nada hoy.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {deliveredToday.map((order) => (
              <li key={order.id} className="text-sm">
                <p className="font-medium">
                  Mesa {order.tableLabel} · {formatTime(order.createdAt)}
                </p>
                <ul className="ml-4 text-xs text-gray-600">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.dishName} — {formatPrice(item.priceCents * item.quantity, currency)}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </details>
    </div>
  )
}
