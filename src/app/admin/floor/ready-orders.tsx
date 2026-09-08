'use client'

import { useEffect, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { updateOrderStatus } from '@/app/actions/kitchen'
import type { OrderDetail } from '@/lib/orders'
import { playAlertSound } from '@/lib/alert-sound'
import { setBadgeCount, clearBadgeCount } from '@/lib/tab-badge'

type OrderRow = { id: string; table_session_id: string; status: OrderDetail['status']; created_at: string }

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
    // Cancellation requests only ever apply to "pending" orders — by the
    // time one is "ready" this doesn't come up.
    cancellationRequestedAt: null,
    tableLabel: table?.label ?? '—',
    items: itemList.map((item) => {
      const menuItem = menuItemById.get(item.menu_item_id)
      return {
        id: item.id,
        quantity: item.quantity,
        dishName: menuItem?.name ?? '—',
        priceCents: menuItem?.price_cents ?? 0,
        participantName: participantNameById.get(item.participant_id) ?? '—',
        station: 'kitchen' as const, // irrelevant here — Barra always shows every item
        note: item.note,
      }
    }),
  }
}

// Returns null on a failed fetch (instead of []) so a resync that fails
// leaves the board as-is rather than wiping it to "nothing ready" — worse
// than just staying stale for a few seconds.
async function fetchReadyOrders(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string
): Promise<OrderDetail[] | null> {
  const { data: rows, error } = await supabase
    .from('orders')
    .select('id, table_session_id, status, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'ready')
    .order('created_at', { ascending: true })

  if (error) return null

  const full = await Promise.all((rows ?? []).map((row) => loadFullOrder(supabase, row as OrderRow)))
  return full.filter((o): o is OrderDetail => o !== null)
}

export function ReadyOrders({
  restaurantId,
  initialOrders,
}: {
  restaurantId: string
  initialOrders: OrderDetail[]
}) {
  const [orders, setOrders] = useState(initialOrders)
  const hasConnectedBefore = useRef(false)

  useEffect(() => {
    setBadgeCount('ready-orders', orders.length)
    return () => clearBadgeCount('ready-orders')
  }, [orders.length])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`floor-ready-${restaurantId}`)
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
          if (row.status !== 'ready') return
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
          if (row.status === 'delivered') {
            setOrders((current) => current.filter((o) => o.id !== row.id))
            return
          }
          if (row.status !== 'ready') return
          // An order becomes "ready" via an UPDATE (kitchen finishing prep),
          // not an INSERT, so it needs adding here rather than above.
          const full = await loadFullOrder(supabase, row)
          if (!full) return
          playAlertSound()
          setOrders((current) =>
            current.some((o) => o.id === full.id) ? current : [...current, full]
          )
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        fetchReadyOrders(supabase, restaurantId).then((fresh) => {
          if (fresh) setOrders(fresh)
        })
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Listos para servir</h2>
      {orders.length === 0 ? (
        <p className="text-sm text-gray-500">Nada esperando para servir ahora mismo.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-col gap-3 rounded border-2 border-green-600 p-4">
              <h3 className="font-semibold">Mesa {order.tableLabel}</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {order.items.map((item) => (
                  <li key={item.id}>
                    {item.quantity}× {item.dishName}{' '}
                    <span className="text-gray-500">— {item.participantName}</span>
                    {item.note && <p className="text-xs font-medium text-red-600">⚠ {item.note}</p>}
                  </li>
                ))}
              </ul>
              <form action={updateOrderStatus}>
                <input type="hidden" name="id" value={order.id} />
                <input type="hidden" name="status" value="delivered" />
                <button type="submit" className="rounded bg-sage px-3 py-1 text-xs font-medium text-white">
                  Marcar como entregado
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
