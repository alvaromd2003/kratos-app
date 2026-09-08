'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import { createItemizedPayment } from '@/app/actions/payments'

type PickableItem = {
  id: string
  name: string
  remainingCents: number
  participantLabel: string
  contributors: { label: string; amountCents: number }[]
}

export function ItemizedPaymentPanel({
  qrToken,
  currency,
  items,
  loyaltyDiscountPercent,
}: {
  qrToken: string
  currency: string
  items: PickableItem[]
  loyaltyDiscountPercent: number
}) {
  const [state, action, pending] = useActionState(createItemizedPayment, undefined)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // How many ways each selected dish is being split — defaults to 1 (pay
  // it in full). Only meaningful while the item is selected. Kept as the
  // raw typed string (not a clamped number) so the field can go through
  // an empty state while editing — clamping on every keystroke made it
  // snap straight back to 1 the instant you deleted it, and you could
  // never type a second digit.
  const [shareCounts, setShareCounts] = useState<Record<string, string>>({})
  const [tipPercent, setTipPercent] = useState(0)

  if (items.length === 0) return null

  const shareCountFor = (id: string) => {
    const parsed = parseInt(shareCounts[id] ?? '1', 10)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1
  }
  const myShareCents = (item: PickableItem) => Math.ceil(item.remainingCents / shareCountFor(item.id))

  const baseCents = items
    .filter((item) => selected.has(item.id))
    .reduce((sum, item) => sum + myShareCents(item), 0)
  // Mirrors createPaymentCheckout server-side: discount and tip both come
  // off the same base amount, never compounded.
  const discountCents = Math.round((baseCents * loyaltyDiscountPercent) / 100)
  const tipCents = Math.round((baseCents * tipPercent) / 100)
  const totalCents = baseCents - discountCents + tipCents

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
    <form action={action} className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <input type="hidden" name="qr_token" value={qrToken} />
      <input type="hidden" name="tip_percent" value={tipPercent} />

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Elegir platos concretos</h2>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs underline">
          Cerrar
        </button>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
              />
              {item.name} — {item.participantLabel}
              <span className="ml-auto text-gray-500">
                Queda: {formatPrice(item.remainingCents, currency)}
              </span>
            </label>
            {item.contributors.length > 0 && (
              <p className="ml-6 text-xs text-gray-500">
                Ya pagado:{' '}
                {item.contributors
                  .map((c) => `${c.label} ${formatPrice(c.amountCents, currency)}`)
                  .join(', ')}
              </p>
            )}
            {selected.has(item.id) && (
              <label className="ml-6 flex items-center gap-2 text-xs text-gray-600">
                Dividir entre
                <input
                  type="number"
                  min={1}
                  value={shareCounts[item.id] ?? '1'}
                  onChange={(e) =>
                    setShareCounts((current) => ({ ...current, [item.id]: e.target.value }))
                  }
                  onBlur={() =>
                    setShareCounts((current) => ({
                      ...current,
                      [item.id]: String(shareCountFor(item.id)),
                    }))
                  }
                  className="w-14 rounded border border-gray-300 px-2 py-1"
                />
                <input type="hidden" name="order_item_id" value={item.id} />
                <input
                  type="hidden"
                  name={`share_count_${item.id}`}
                  value={shareCountFor(item.id)}
                />
                = tu parte: {formatPrice(myShareCents(item), currency)}
              </label>
            )}
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

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm">Total: {formatPrice(totalCents, currency)}</span>
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {pending ? 'Redirigiendo…' : 'Pagar estos platos'}
        </button>
      </div>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  )
}
