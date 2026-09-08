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
  tableParticipants,
  currentParticipantId,
}: {
  qrToken: string
  currency: string
  items: PickableItem[]
  loyaltyDiscountPercent: number
  // Everyone at the table who could plausibly split a dish (excludes the
  // "Pedido en barra" staff-assisted pseudo-participant, which is never a
  // real payer). Used to pick WHO a dish is split between by name, not by
  // typing a raw headcount.
  tableParticipants: { id: string; label: string }[]
  currentParticipantId: string
}) {
  const [state, action, pending] = useActionState(createItemizedPayment, undefined)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  // Per item: which OTHER participants (besides yourself, who's always
  // included) it's being split with. Naming names instead of typing a
  // count is both clearer about who owes what and sidesteps the earlier
  // "can't clear the 1 to type 2" input bug entirely — there's no free-typed
  // number anymore.
  const [splitWith, setSplitWith] = useState<Record<string, Set<string>>>({})
  const [tipPercent, setTipPercent] = useState(0)

  if (items.length === 0) return null

  const othersFor = (id: string) => splitWith[id] ?? new Set<string>()
  const shareCountFor = (id: string) => 1 + othersFor(id).size
  const myShareCents = (item: PickableItem) => Math.ceil(item.remainingCents / shareCountFor(item.id))

  function toggleSplitParticipant(itemId: string, otherParticipantId: string) {
    setSplitWith((current) => {
      const next = new Set(othersFor(itemId))
      if (next.has(otherParticipantId)) {
        next.delete(otherParticipantId)
      } else {
        next.add(otherParticipantId)
      }
      return { ...current, [itemId]: next }
    })
  }

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
              <div className="ml-6 flex flex-col gap-1.5 text-xs text-gray-600">
                {tableParticipants.filter((p) => p.id !== currentParticipantId).length > 0 && (
                  <>
                    <span>¿Entre quién se divide?</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full border border-black bg-black px-2 py-0.5 text-white">
                        Tú
                      </span>
                      {tableParticipants
                        .filter((p) => p.id !== currentParticipantId)
                        .map((p) => {
                          const active = othersFor(item.id).has(p.id)
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleSplitParticipant(item.id, p.id)}
                              className={`rounded-full border px-2 py-0.5 ${
                                active
                                  ? 'border-black bg-black text-white'
                                  : 'border-gray-300 text-gray-700'
                              }`}
                            >
                              {p.label}
                            </button>
                          )
                        })}
                    </div>
                  </>
                )}
                <input type="hidden" name="order_item_id" value={item.id} />
                <input
                  type="hidden"
                  name={`share_count_${item.id}`}
                  value={shareCountFor(item.id)}
                />
                <span>
                  {shareCountFor(item.id) > 1
                    ? `Se divide entre ${shareCountFor(item.id)} personas · `
                    : ''}
                  tu parte: {formatPrice(myShareCents(item), currency)}
                </span>
              </div>
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
