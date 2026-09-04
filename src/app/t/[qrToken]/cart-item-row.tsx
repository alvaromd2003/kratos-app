'use client'

import { changeItemQuantity, removeItemFromCart } from '@/app/actions/ordering'

export function CartItemRow({
  qrToken,
  orderItemId,
  name,
  quantity,
  lineTotal,
}: {
  qrToken: string
  orderItemId: string
  name: string
  quantity: number
  lineTotal: string
}) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className="flex-1 truncate">{name}</span>
      <div className="flex items-center gap-1">
        <form action={changeItemQuantity}>
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="order_item_id" value={orderItemId} />
          <input type="hidden" name="delta" value="-1" />
          <button type="submit" className="h-6 w-6 rounded border border-gray-300">
            −
          </button>
        </form>
        <span className="w-5 text-center">{quantity}</span>
        <form action={changeItemQuantity}>
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="order_item_id" value={orderItemId} />
          <input type="hidden" name="delta" value="1" />
          <button type="submit" className="h-6 w-6 rounded border border-gray-300">
            +
          </button>
        </form>
      </div>
      <span className="w-16 text-right">{lineTotal}</span>
      <form action={removeItemFromCart}>
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="order_item_id" value={orderItemId} />
        <button type="submit" className="text-xs text-red-600 underline">
          Quitar
        </button>
      </form>
    </li>
  )
}
