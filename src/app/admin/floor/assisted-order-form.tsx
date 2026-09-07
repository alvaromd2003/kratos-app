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
    <div className="flex flex-col gap-2 rounded border border-gray-200 bg-gray-50 p-2">
      <form action={addAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="table_id" value={tableId} />
        <select name="menu_item_id" className="rounded border border-gray-300 px-2 py-1 text-xs">
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
          className="w-14 rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <button
          type="submit"
          disabled={addPending}
          className="rounded border border-gray-400 px-2 py-1 text-xs disabled:opacity-50"
        >
          {addPending ? 'Añadiendo…' : 'Añadir'}
        </button>
      </form>
      {addState?.error && <p className="text-xs text-red-600">{addState.error}</p>}

      <form action={sendAction}>
        <input type="hidden" name="table_id" value={tableId} />
        <button
          type="submit"
          disabled={sendPending}
          className="rounded bg-black px-2 py-1 text-xs text-white disabled:opacity-50"
        >
          {sendPending ? 'Enviando…' : 'Enviar a cocina'}
        </button>
      </form>
      {sendState?.error && <p className="text-xs text-red-600">{sendState.error}</p>}
    </div>
  )
}
