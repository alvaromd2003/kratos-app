'use client'

import { useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { updateOrderStatus } from '@/app/actions/kitchen'

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'

export type KitchenOrder = {
  id: string
  status: OrderStatus
  createdAt: string
  tableLabel: string
  items: { id: string; quantity: number; dishName: string; participantName: string }[]
}

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
): Promise<KitchenOrder | null> {
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
      ? supabase.from('menu_items').select('id, name').in('id', menuItemIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase.from('session_participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] }),
  ])

  const menuItemNameById = new Map((menuItems ?? []).map((m) => [m.id, m.name]))
  const participantNameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    tableLabel: table?.label ?? '—',
    items: itemList.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      dishName: menuItemNameById.get(item.menu_item_id) ?? '—',
      participantName: participantNameById.get(item.participant_id) ?? '—',
    })),
  }
}

export function KitchenBoard({
  restaurantId,
  initialOrders,
}: {
  restaurantId: string
  initialOrders: KitchenOrder[]
}) {
  const [orders, setOrders] = useState(initialOrders)

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
        (payload) => {
          const row = payload.new as OrderRow
          setOrders((current) => {
            if (row.status === 'delivered') {
              return current.filter((o) => o.id !== row.id)
            }
            return current.map((o) => (o.id === row.id ? { ...o, status: row.status } : o))
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  if (orders.length === 0) {
    return <p className="text-gray-600">No hay pedidos pendientes ahora mismo.</p>
  }

  return (
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
              <button
                type="submit"
                className="rounded bg-black px-3 py-1 text-xs text-white"
              >
                Marcar como {STATUS_LABEL[NEXT_STATUS[order.status]!].toLowerCase()}
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  )
}
