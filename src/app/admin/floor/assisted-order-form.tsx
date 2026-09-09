'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import { addStaffItem, sendStaffOrder } from '@/app/actions/staff-order'
import { useLocale } from '@/lib/i18n/provider'

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
  const { t } = useLocale()
  const [addState, addAction, addPending] = useActionState(addStaffItem, undefined)
  const [sendState, sendAction, sendPending] = useActionState(sendStaffOrder, undefined)
  const [selectedId, setSelectedId] = useState(menuItems[0]?.id ?? '')
  const [quantity, setQuantity] = useState(1)
  const [note, setNote] = useState('')

  if (menuItems.length === 0) return null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-marble p-4">
      <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto rounded-lg border border-marble-3 bg-white p-1.5">
        {menuItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSelectedId(item.id)}
            className={`flex items-center justify-between gap-3 rounded-lg px-4 py-3 text-left text-sm font-medium transition-colors ${
              selectedId === item.id ? 'bg-ink text-white' : 'text-ink hover:bg-marble-2'
            }`}
          >
            <span>{item.name}</span>
            <span className="font-mono">{formatPrice(item.price_cents, currency)}</span>
          </button>
        ))}
      </div>

      <form
        action={addAction}
        className="flex flex-wrap items-center gap-2.5"
        onSubmit={() => {
          // Deferred so the current values still make it into this
          // submission's FormData before the fields reset for next time.
          setTimeout(() => {
            setQuantity(1)
            setNote('')
          }, 0)
        }}
      >
        <input type="hidden" name="table_id" value={tableId} />
        <input type="hidden" name="menu_item_id" value={selectedId} />
        <input type="hidden" name="quantity" value={quantity} />

        <div className="flex items-center overflow-hidden rounded-lg border border-marble-3 bg-white">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="px-4 py-2.5 text-lg font-semibold text-bronze"
            aria-label={t('floor.lessQuantity')}
          >
            −
          </button>
          <span className="w-8 text-center text-base font-semibold text-ink">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(20, q + 1))}
            className="px-4 py-2.5 text-lg font-semibold text-bronze"
            aria-label={t('floor.moreQuantity')}
          >
            +
          </button>
        </div>

        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          name="note"
          placeholder={t('floor.notePlaceholder')}
          maxLength={140}
          className="min-w-0 flex-1 rounded-lg border border-marble-3 bg-white px-3 py-2.5 text-sm text-ink"
        />
        <button
          type="submit"
          disabled={addPending || !selectedId}
          className="rounded-lg bg-ember px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {addPending ? t('common.adding') : t('common.add')}
        </button>
      </form>
      {addState?.errorCode && <p className="text-sm text-rust">{t(`error.${addState.errorCode}`)}</p>}

      <form action={sendAction}>
        <input type="hidden" name="table_id" value={tableId} />
        <button
          type="submit"
          disabled={sendPending}
          className="w-full rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sendPending ? t('floor.sending') : t('floor.sendToKitchen')}
        </button>
      </form>
      {sendState?.errorCode && <p className="text-sm text-rust">{t(`error.${sendState.errorCode}`)}</p>}
    </div>
  )
}
