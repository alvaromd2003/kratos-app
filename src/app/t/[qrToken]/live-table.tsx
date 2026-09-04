'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatTime } from '@/lib/format'
import { DIETARY_TAGS, dietaryTagLabel } from '@/lib/dietary-tags'
import { cancelOrder } from '@/app/actions/ordering'
import { AddItemButton } from './add-item-button'
import { CartItemRow } from './cart-item-row'
import { SendOrderButton } from './send-order-button'
import { HelpButton } from './help-button'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  dietary_tags: string[]
  recommended_item_id: string | null
}
type Participant = { id: string; name: string }
type OrderItemRow = {
  id: string
  menu_item_id: string
  participant_id: string
  quantity: number
  order_id: string | null
  note: string | null
}
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'
type OrderRow = { id: string; status: OrderStatus; created_at: string }
type ActiveOrderRow = { id: string; status: OrderStatus; created_at: string }

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista para servir',
  delivered: 'Entregado',
}

function applyChange<T extends { id: string }>(
  current: T[],
  payload: RealtimePostgresChangesPayload<T>
): T[] {
  if (payload.eventType === 'INSERT') {
    const row = payload.new as T
    if (current.some((r) => r.id === row.id)) return current
    return [...current, row]
  }
  if (payload.eventType === 'UPDATE') {
    const row = payload.new as T
    return current.map((r) => (r.id === row.id ? row : r))
  }
  if (payload.eventType === 'DELETE') {
    const old = payload.old as Partial<T>
    return current.filter((r) => r.id !== old.id)
  }
  return current
}

export function LiveTable({
  qrToken,
  tableLabel,
  restaurantName,
  currency,
  restaurantId,
  tableSessionId,
  participantId,
  categories,
  items,
  initialParticipants,
  initialOrderItems,
  initialOrders,
  initialRestaurantActiveOrders,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
  currency: string
  restaurantId: string
  tableSessionId: string
  participantId: string
  categories: Category[]
  items: MenuItem[]
  initialParticipants: Participant[]
  initialOrderItems: OrderItemRow[]
  initialOrders: OrderRow[]
  initialRestaurantActiveOrders: ActiveOrderRow[]
}) {
  const [participants, setParticipants] = useState(initialParticipants)
  const [orderItems, setOrderItems] = useState(initialOrderItems)
  const [orders, setOrders] = useState(initialOrders)
  const [restaurantActiveOrders, setRestaurantActiveOrders] = useState(
    initialRestaurantActiveOrders
  )
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const hasConnectedBefore = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    async function resync() {
      const [
        { data: freshOrderItems },
        { data: freshParticipants },
        { data: freshOrders },
        { data: freshActive },
      ] = await Promise.all([
        supabase
          .from('order_items')
          .select('id, menu_item_id, participant_id, quantity, order_id, note')
          .eq('table_session_id', tableSessionId),
        supabase
          .from('session_participants')
          .select('id, name')
          .eq('table_session_id', tableSessionId),
        supabase.from('orders').select('id, status, created_at').eq('table_session_id', tableSessionId),
        supabase
          .from('orders')
          .select('id, status, created_at')
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'preparing']),
      ])
      if (freshOrderItems) setOrderItems(freshOrderItems)
      if (freshParticipants) setParticipants(freshParticipants)
      if (freshOrders) setOrders(freshOrders)
      if (freshActive) setRestaurantActiveOrders(freshActive)
    }

    const channel = supabase
      .channel(`table-session-${tableSessionId}`)
      .on<OrderItemRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setOrderItems((current) => applyChange(current, payload))
      )
      .on<Participant>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setParticipants((current) => applyChange(current, payload))
      )
      .on<OrderRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setOrders((current) => applyChange(current, payload))
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        // Reconnected after a drop (spotty wifi is common in a dining
        // room) — postgres_changes doesn't replay what was missed, so
        // pull a fresh snapshot instead of silently going stale.
        resync()
      })

    // Separate channel: every other table's orders, just enough to know
    // "how many are ahead of mine in the kitchen queue" — restaurant-wide,
    // not scoped to this table.
    const queueChannel = supabase
      .channel(`restaurant-queue-${restaurantId}`)
      .on<ActiveOrderRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<ActiveOrderRow>
            setRestaurantActiveOrders((current) => current.filter((o) => o.id !== old.id))
            return
          }
          const row = payload.new as ActiveOrderRow
          const isActive = row.status === 'pending' || row.status === 'preparing'
          setRestaurantActiveOrders((current) => {
            if (!isActive) return current.filter((o) => o.id !== row.id)
            if (current.some((o) => o.id === row.id)) {
              return current.map((o) => (o.id === row.id ? row : o))
            }
            return [...current, row]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(queueChannel)
    }
  }, [tableSessionId, restaurantId])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const participantsById = new Map(participants.map((p) => [p.id, p]))

  const visibleItems = useMemo(() => {
    if (activeTags.size === 0) return items
    return items.filter((item) => [...activeTags].every((tag) => item.dietary_tags.includes(tag)))
  }, [items, activeTags])

  const itemsByCategory = new Map<string | null, MenuItem[]>()
  for (const item of visibleItems) {
    itemsByCategory.set(item.category_id, [...(itemsByCategory.get(item.category_id) ?? []), item])
  }
  const uncategorized = itemsByCategory.get(null) ?? []

  // Items already sent to the kitchen leave the editable cart — the diner
  // can still start a new round (drinks, dessert…) underneath. The running
  // total, though, always covers everything ordered this sitting, sent or
  // not — a diner should never lose track of what the table has spent.
  const cartItems = orderItems.filter((row) => row.order_id === null)

  const lineTotal = (row: OrderItemRow) => {
    const item = itemsById.get(row.menu_item_id)
    return item ? item.price_cents * row.quantity : 0
  }
  const cartTotal = cartItems.reduce((sum, row) => sum + lineTotal(row), 0)
  const tableTotal = orderItems.reduce((sum, row) => sum + lineTotal(row), 0)

  const participantLabel = (id: string) => {
    if (id === participantId) return 'Tú'
    return participantsById.get(id)?.name ?? '—'
  }

  const sortedOrders = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at))

  function queuePosition(order: OrderRow): number {
    return restaurantActiveOrders.filter(
      (o) => o.id !== order.id && o.created_at < order.created_at
    ).length
  }

  function toggleTag(tag: string) {
    setActiveTags((current) => {
      const next = new Set(current)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6 pb-56">
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">{restaurantName}</h1>
        <p className="text-sm text-gray-600">
          Mesa {tableLabel} · {participants.map((p) => participantLabel(p.id)).join(', ')}
        </p>
        <p className="text-sm font-medium">
          Total de la mesa: {formatPrice(tableTotal, currency)}
        </p>
        <HelpButton qrToken={qrToken} />
      </div>

      {sortedOrders.length > 0 && (
        <section className="flex flex-col gap-3 rounded border border-gray-200 p-3">
          <h2 className="font-medium">Tus pedidos</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {sortedOrders.map((order) => {
              const orderRows = orderItems.filter((row) => row.order_id === order.id)
              const ahead = order.status === 'pending' ? queuePosition(order) : 0
              return (
                <li key={order.id}>
                  <div className="flex items-center justify-between gap-2">
                    <p>
                      <span className="font-medium">{formatTime(order.created_at)}</span> —{' '}
                      {ORDER_STATUS_LABEL[order.status]}
                      {order.status === 'pending' && (
                        <span className="text-gray-500">
                          {' '}
                          ({ahead > 0 ? `${ahead} por delante` : 'el siguiente'})
                        </span>
                      )}
                    </p>
                    {order.status === 'pending' && (
                      <form
                        action={cancelOrder}
                        onSubmit={(e) => {
                          if (!confirm('¿Cancelar este pedido? Los platos volverán al carrito.')) {
                            e.preventDefault()
                          }
                        }}
                      >
                        <input type="hidden" name="qr_token" value={qrToken} />
                        <input type="hidden" name="order_id" value={order.id} />
                        <button type="submit" className="text-xs text-red-600 underline">
                          Cancelar
                        </button>
                      </form>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">
                    {orderRows
                      .map((row) => `${row.quantity}× ${itemsById.get(row.menu_item_id)?.name ?? '—'}`)
                      .join(', ')}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {DIETARY_TAGS.map((tag) => (
          <button
            key={tag.value}
            type="button"
            onClick={() => toggleTag(tag.value)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeTags.has(tag.value)
                ? 'border-black bg-black text-white'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {tag.label}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-6">
        {categories.map((category) => {
          const categoryItems = itemsByCategory.get(category.id) ?? []
          if (categoryItems.length === 0) return null
          return (
            <MenuSection
              key={category.id}
              title={category.name}
              items={categoryItems}
              qrToken={qrToken}
              currency={currency}
              itemsById={itemsById}
            />
          )
        })}
        {uncategorized.length > 0 && (
          <MenuSection
            title="Otros"
            items={uncategorized}
            qrToken={qrToken}
            currency={currency}
            itemsById={itemsById}
          />
        )}
        {visibleItems.length === 0 && (
          <p className="text-sm text-gray-500">Ningún plato coincide con esos filtros.</p>
        )}
      </section>

      <section className="fixed inset-x-0 bottom-0 flex max-h-64 flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 text-gray-900 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <h2 className="font-medium">Carrito de la mesa</h2>
        {cartItems.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay nada en el carrito.</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {cartItems.map((row) => {
              const item = itemsById.get(row.menu_item_id)
              if (!item) return null
              return (
                <CartItemRow
                  key={row.id}
                  qrToken={qrToken}
                  orderItemId={row.id}
                  name={`${item.name} — ${participantLabel(row.participant_id)}`}
                  quantity={row.quantity}
                  note={row.note}
                  lineTotal={formatPrice(item.price_cents * row.quantity, currency)}
                />
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">
            Total del carrito: {formatPrice(cartTotal, currency)}
          </p>
          {cartItems.length > 0 && <SendOrderButton qrToken={qrToken} />}
        </div>
      </section>
    </main>
  )
}

function MenuSection({
  title,
  items,
  qrToken,
  currency,
  itemsById,
}: {
  title: string
  items: MenuItem[]
  qrToken: string
  currency: string
  itemsById: Map<string, MenuItem>
}) {
  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-medium">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3">
            {item.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.name}
                width={56}
                height={56}
                className="h-14 w-14 rounded object-cover"
              />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium">{item.name}</p>
              {item.description && <p className="text-xs text-gray-600">{item.description}</p>}
              <p className="text-xs text-gray-500">{formatPrice(item.price_cents, currency)}</p>
              {item.dietary_tags.length > 0 && (
                <p className="text-xs text-gray-500">
                  {item.dietary_tags.map(dietaryTagLabel).join(' · ')}
                </p>
              )}
            </div>
            <AddItemButton
              qrToken={qrToken}
              menuItemId={item.id}
              recommendedItem={
                item.recommended_item_id ? (itemsById.get(item.recommended_item_id) ?? null) : null
              }
              currency={currency}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
