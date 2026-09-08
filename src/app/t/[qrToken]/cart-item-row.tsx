'use client'

import { useActionState } from 'react'
import { changeItemQuantity, removeItemFromCart, setItemNote } from '@/app/actions/ordering'

export function CartItemRow({
  qrToken,
  orderItemId,
  name,
  quantity,
  note,
  lineTotal,
}: {
  qrToken: string
  orderItemId: string
  name: string
  quantity: number
  note: string | null
  lineTotal: string
}) {
  const [decreaseState, decreaseAction] = useActionState(changeItemQuantity, undefined)
  const [increaseState, increaseAction] = useActionState(changeItemQuantity, undefined)
  const [removeState, removeAction] = useActionState(removeItemFromCart, undefined)

  return (
    <li className="flex flex-col gap-1 text-sm">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate">{name}</span>
        <div className="flex items-center gap-1">
          <form action={decreaseAction}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="order_item_id" value={orderItemId} />
            <input type="hidden" name="delta" value="-1" />
            <button type="submit" className="h-6 w-6 rounded border border-gray-300">
              −
            </button>
          </form>
          <span className="w-5 text-center">{quantity}</span>
          <form action={increaseAction}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="order_item_id" value={orderItemId} />
            <input type="hidden" name="delta" value="1" />
            <button type="submit" className="h-6 w-6 rounded border border-gray-300">
              +
            </button>
          </form>
        </div>
        <span className="w-16 text-right">{lineTotal}</span>
        <form action={removeAction}>
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="order_item_id" value={orderItemId} />
          <button type="submit" className="text-xs text-red-600 underline">
            Quitar
          </button>
        </form>
      </div>
      {(decreaseState?.error || increaseState?.error || removeState?.error) && (
        <p className="text-xs text-red-600">
          {decreaseState?.error || increaseState?.error || removeState?.error}
        </p>
      )}
      <form action={setItemNote} className="flex items-center gap-1 pl-0">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="order_item_id" value={orderItemId} />
        <input
          name="note"
          defaultValue={note ?? ''}
          placeholder="Nota (ej: sin cebolla)"
          maxLength={140}
          className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
        />
        <button type="submit" className="text-xs underline">
          Guardar
        </button>
      </form>
    </li>
  )
}
