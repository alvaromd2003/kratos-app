'use client'

import { useEffect, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatPrice } from '@/lib/format'
import { AddItemButton } from './add-item-button'
import { CartItemRow } from './cart-item-row'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
}
type Participant = { id: string; name: string }
type OrderItemRow = { id: string; menu_item_id: string; participant_id: string; quantity: number }

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
  tableSessionId,
  participantId,
  categories,
  items,
  initialParticipants,
  initialOrderItems,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
  currency: string
  tableSessionId: string
  participantId: string
  categories: Category[]
  items: MenuItem[]
  initialParticipants: Participant[]
  initialOrderItems: OrderItemRow[]
}) {
  const [participants, setParticipants] = useState(initialParticipants)
  const [orderItems, setOrderItems] = useState(initialOrderItems)

  useEffect(() => {
    const supabase = createClient()
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
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tableSessionId])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const participantsById = new Map(participants.map((p) => [p.id, p]))
  const itemsByCategory = new Map<string | null, MenuItem[]>()
  for (const item of items) {
    itemsByCategory.set(item.category_id, [...(itemsByCategory.get(item.category_id) ?? []), item])
  }
  const uncategorized = itemsByCategory.get(null) ?? []

  const total = orderItems.reduce((sum, row) => {
    const item = itemsById.get(row.menu_item_id)
    return sum + (item ? item.price_cents * row.quantity : 0)
  }, 0)

  const participantLabel = (id: string) => {
    if (id === participantId) return 'Tú'
    return participantsById.get(id)?.name ?? '—'
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6 pb-56">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold">{restaurantName}</h1>
        <p className="text-sm text-gray-600">
          Mesa {tableLabel} · {participants.map((p) => participantLabel(p.id)).join(', ')}
        </p>
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
            />
          )
        })}
        {uncategorized.length > 0 && (
          <MenuSection title="Otros" items={uncategorized} qrToken={qrToken} currency={currency} />
        )}
      </section>

      <section className="fixed inset-x-0 bottom-0 flex max-h-64 flex-col gap-3 border-t border-gray-200 bg-white px-4 py-4 shadow-[0_-4px_12px_rgba(0,0,0,0.08)]">
        <h2 className="font-medium">Carrito de la mesa</h2>
        {orderItems.length === 0 ? (
          <p className="text-sm text-gray-500">Todavía no hay nada en el carrito.</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {orderItems.map((row) => {
              const item = itemsById.get(row.menu_item_id)
              if (!item) return null
              return (
                <CartItemRow
                  key={row.id}
                  qrToken={qrToken}
                  orderItemId={row.id}
                  name={`${item.name} — ${participantLabel(row.participant_id)}`}
                  quantity={row.quantity}
                  lineTotal={formatPrice(item.price_cents * row.quantity, currency)}
                />
              )
            })}
          </ul>
        )}
        <p className="text-right text-sm font-semibold">Total: {formatPrice(total, currency)}</p>
      </section>
    </main>
  )
}

function MenuSection({
  title,
  items,
  qrToken,
  currency,
}: {
  title: string
  items: MenuItem[]
  qrToken: string
  currency: string
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
            </div>
            <AddItemButton qrToken={qrToken} menuItemId={item.id} />
          </li>
        ))}
      </ul>
    </div>
  )
}
