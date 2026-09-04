'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatTime } from '@/lib/format'
import { updateOrderStatus, cancelOrderAsStaff } from '@/app/actions/kitchen'
import type { OrderDetail } from '@/lib/orders'
import { playAlertSound } from '@/lib/alert-sound'
import { setBadgeCount, clearBadgeCount } from '@/lib/tab-badge'
import { useWakeLock } from '@/lib/use-wake-lock'

type OrderStatus = OrderDetail['status']
type OrderRow = { id: string; table_session_id: string; status: OrderStatus; created_at: string }

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: 'preparing',
  preparing: 'ready',
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
    .select('id, quantity, menu_item_id, participant_id, note')
    .eq('order_id', row.id)

  const itemList = items ?? []
  const menuItemIds = [...new Set(itemList.map((i) => i.menu_item_id))]
  const participantIds = [...new Set(itemList.map((i) => i.participant_id))]

  const [{ data: menuItems }, { data: participants }] = await Promise.all([
    menuItemIds.length > 0
      ? supabase.from('menu_items').select('id, name, price_cents, category_id').in('id', menuItemIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase.from('session_participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] }),
  ])

  const menuItemList = menuItems ?? []
  const categoryIds = [
    ...new Set(menuItemList.map((m) => m.category_id).filter((id): id is string => !!id)),
  ]
  const { data: categories } =
    categoryIds.length > 0
      ? await supabase.from('menu_categories').select('id, station').in('id', categoryIds)
      : { data: [] }
  const stationByCategoryId = new Map((categories ?? []).map((c) => [c.id, c.station]))

  const menuItemById = new Map(menuItemList.map((m) => [m.id, m]))
  const participantNameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    tableLabel: table?.label ?? '—',
    items: itemList.map((item) => {
      const menuItem = menuItemById.get(item.menu_item_id)
      const station = menuItem?.category_id
        ? (stationByCategoryId.get(menuItem.category_id) ?? 'kitchen')
        : 'kitchen'
      return {
        id: item.id,
        quantity: item.quantity,
        dishName: menuItem?.name ?? '—',
        priceCents: menuItem?.price_cents ?? 0,
        participantName: participantNameById.get(item.participant_id) ?? '—',
        station: station as 'kitchen' | 'bar',
        note: item.note,
      }
    }),
  }
}

async function fetchPendingOrders(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string
): Promise<OrderDetail[]> {
  const { data: rows } = await supabase
    .from('orders')
    .select('id, table_session_id, status, created_at')
    .eq('restaurant_id', restaurantId)
    .in('status', ['pending', 'preparing'])
    .order('created_at', { ascending: true })

  const full = await Promise.all((rows ?? []).map((row) => loadFullOrder(supabase, row as OrderRow)))
  return full.filter((o): o is OrderDetail => o !== null)
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
  const hasConnectedBefore = useRef(false)

  useWakeLock()

  useEffect(() => {
    setBadgeCount('kitchen-orders', orders.length)
    return () => clearBadgeCount('kitchen-orders')
  }, [orders.length])

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
          // A drinks-only round is created as "ready" straight away (no
          // kitchen items at all) — that one's not Cocina's to show.
          if (row.status !== 'pending' && row.status !== 'preparing') return
          const full = await loadFullOrder(supabase, row)
          if (!full) return
          playAlertSound()
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
          // Once it's ready (or somehow already delivered), it's not the
          // kitchen's concern anymore — that's Barra's board now.
          if (row.status === 'ready' || row.status === 'delivered') {
            setOrders((current) => current.filter((o) => o.id !== row.id))
          }
          if (row.status === 'delivered') {
            const full = await loadFullOrder(supabase, row)
            if (full) {
              setDeliveredToday((current) =>
                current.some((o) => o.id === full.id) ? current : [full, ...current]
              )
            }
            return
          }
          if (row.status === 'ready') return
          setOrders((current) =>
            current.map((o) => (o.id === row.id ? { ...o, status: row.status } : o))
          )
        }
      )
      .on<{ id: string }>(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orders' },
        (payload) => {
          const old = payload.old as { id?: string }
          if (!old.id) return
          setOrders((current) => current.filter((o) => o.id !== old.id))
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        // Reconnected after a drop — postgres_changes doesn't replay what
        // was missed, so pull a fresh snapshot to avoid a stale board.
        fetchPendingOrders(supabase, restaurantId).then(setOrders)
      })

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
                {order.items
                  .filter((item) => item.station === 'kitchen')
                  .map((item) => (
                    <li key={item.id}>
                      {item.quantity}× {item.dishName}{' '}
                      <span className="text-gray-500">— {item.participantName}</span>
                      {item.note && (
                        <p className="text-xs font-medium text-red-600">⚠ {item.note}</p>
                      )}
                    </li>
                  ))}
              </ul>
              <div className="flex items-center gap-3">
                {NEXT_STATUS[order.status] && (
                  <form action={updateOrderStatus}>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="status" value={NEXT_STATUS[order.status]!} />
                    <button type="submit" className="rounded bg-black px-3 py-1 text-xs text-white">
                      Marcar como {STATUS_LABEL[NEXT_STATUS[order.status]!].toLowerCase()}
                    </button>
                  </form>
                )}
                {order.status === 'pending' && (
                  <form
                    action={cancelOrderAsStaff}
                    onSubmit={(e) => {
                      if (!confirm(`¿Cancelar el pedido de la mesa ${order.tableLabel}? Los platos volverán al carrito del cliente.`)) {
                        e.preventDefault()
                      }
                    }}
                  >
                    <input type="hidden" name="id" value={order.id} />
                    <button type="submit" className="text-xs text-red-600 underline">
                      Cancelar
                    </button>
                  </form>
                )}
              </div>
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
