'use client'

import { useActionState } from 'react'
import { changeItemQuantity, removeItemFromCart, setItemNote } from '@/app/actions/ordering'
import { useLocale } from '@/lib/i18n/provider'

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
  const { t } = useLocale()
  const errorCode = decreaseState?.errorCode || increaseState?.errorCode || removeState?.errorCode

  return (
    <li className="flex flex-col gap-1.5 border-b border-marble-2 pb-3 text-sm last:border-b-0 last:pb-0">
      <div className="flex items-center gap-2">
        <span className="flex-1 truncate text-ink">{name}</span>
        <div className="flex items-center gap-1.5">
          <form action={decreaseAction}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="order_item_id" value={orderItemId} />
            <input type="hidden" name="delta" value="-1" />
            <button
              type="submit"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-marble-3 text-bronze"
            >
              −
            </button>
          </form>
          <span className="w-5 text-center font-mono text-ink">{quantity}</span>
          <form action={increaseAction}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="order_item_id" value={orderItemId} />
            <input type="hidden" name="delta" value="1" />
            <button
              type="submit"
              className="flex h-6 w-6 items-center justify-center rounded-full border border-marble-3 text-bronze"
            >
              +
            </button>
          </form>
        </div>
        <span className="w-16 text-right font-mono text-ink">{lineTotal}</span>
        <form action={removeAction}>
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="order_item_id" value={orderItemId} />
          <button type="submit" className="text-xs text-rust underline">
            {t('cart.remove')}
          </button>
        </form>
      </div>
      {errorCode && <p className="text-xs text-rust">{t(`error.${errorCode}`)}</p>}
      <form action={setItemNote} className="flex items-center gap-1.5 pl-0">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="order_item_id" value={orderItemId} />
        <input
          name="note"
          defaultValue={note ?? ''}
          placeholder={t('cart.notePlaceholder')}
          maxLength={140}
          className="w-full rounded-lg border border-marble-3 px-2.5 py-1.5 text-xs text-ink focus:border-ember focus:outline-none"
        />
        <button type="submit" className="text-xs whitespace-nowrap text-bronze underline">
          {t('cart.save')}
        </button>
      </form>
    </li>
  )
}
