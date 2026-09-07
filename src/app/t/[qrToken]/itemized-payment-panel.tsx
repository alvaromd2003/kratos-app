'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import { createItemizedPayment } from '@/app/actions/payments'

type PickableItem = {
  id: string
  name: string
  priceCents: number
  quantity: number
  participantLabel: string
}

export function ItemizedPaymentPanel({
  qrToken,
  currency,
  items,
}: {
  qrToken: string
  currency: string
  items: PickableItem[]
}) {
  const [state, action, pending] = useActionState(createItemizedPayment, undefined)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [tipPercent, setTipPercent] = useState(0)

  if (items.length === 0) return null

  const baseCents = items
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + item.priceCents * item.quantity, 0)
  const totalCents = baseCents + Math.round((baseCents * tipPercent) / 100)

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="self-start text-sm underline"
      >
        Elegir platos concretos
      </button>
    )
  }

  return (
    <section className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Elegir platos concretos</h2>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs underline">
          Cerrar
        </button>
      </div>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              {item.quantity}× {item.name} — {item.participantLabel}
              <span className="ml-auto text-gray-500">
                {formatPrice(item.priceCents * item.quantity, currency)}
              </span>
            </label>
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <span className="text-sm">Propina:</span>
        {[0, 5, 10, 15].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => setTipPercent(pct)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              tipPercent === pct
                ? 'border-black bg-black text-white'
                : 'border-gray-300 text-gray-700'
            }`}
          >
            {pct}%
          </button>
        ))}
      </div>

      <form action={action} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="tip_percent" value={tipPercent} />
        {[...selected].map((id) => (
          <input key={id} type="hidden" name="order_item_id" value={id} />
        ))}
        <span className="text-sm">Total: {formatPrice(totalCents, currency)}</span>
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Redirigiendo…' : 'Pagar estos platos'}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </section>
  )
}
