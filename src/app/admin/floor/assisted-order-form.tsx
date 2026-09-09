'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import { addStaffItem, sendStaffOrder } from '@/app/actions/staff-order'

type MenuItem = { id: string; name: string; price_cents: number }

// Quiet fallback, not a headline feature — see the comment in
// src/app/actions/staff-order.ts for why.
export function AssistedOrderForm({
  tableId,
  currency,
  menuItems,
}: {
  tableId: string
  currency: string
  menuItems: MenuItem[]
}) {
  const [addState, addAction, addPending] = useActionState(addStaffItem, undefined)
  const [sendState, sendAction, sendPending] = useActionState(sendStaffOrder, undefined)
  const [quantity, setQuantity] = useState(1)

  if (menuItems.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-marble p-4">
      <form action={addAction} className="flex flex-wrap items-center gap-2.5">
        <input type="hidden" name="table_id" value={tableId} />
        <select
          name="menu_item_id"
          className="min-w-40 rounded-lg border border-marble-3 bg-white px-3 py-2.5 text-sm text-ink"
        >
          {menuItems.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name} — {formatPrice(item.price_cents, currency)}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="quantity"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))}
          className="w-16 rounded-lg border border-marble-3 bg-white px-3 py-2.5 text-sm text-ink"
        />
        <input
          type="text"
          name="note"
          placeholder="Nota (opcional, ej. sin cebolla)"
          maxLength={140}
          className="min-w-0 flex-1 rounded-lg border border-marble-3 bg-white px-3 py-2.5 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={addPending}
          className="rounded-lg border border-marble-3 bg-white px-4 py-2.5 text-sm font-medium text-bronze disabled:opacity-50"
        >
          {addPending ? 'Añadiendo…' : 'Añadir'}
        </button>
      </form>
      {addState?.error && <p className="text-sm text-rust">{addState.error}</p>}

      <form action={sendAction}>
        <input type="hidden" name="table_id" value={tableId} />
        <button
          type="submit"
          disabled={sendPending}
          className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sendPending ? 'Enviando…' : 'Enviar a cocina'}
        </button>
      </form>
      {sendState?.error && <p className="text-sm text-rust">{sendState.error}</p>}
    </div>
  )
}
