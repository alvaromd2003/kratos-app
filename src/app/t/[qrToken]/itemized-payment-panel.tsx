'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import { createItemizedPayment } from '@/app/actions/payments'
import { useLocale } from '@/lib/i18n/provider'

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
  const { t } = useLocale()
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
        className="self-start text-sm font-medium text-bronze underline underline-offset-2"
      >
        {t('payment.chooseItems')}
      </button>
    )
  }

  return (
    <form action={action} className="flex flex-col gap-4 rounded-2xl bg-ink px-5 py-5 text-marble-2">
      <input type="hidden" name="qr_token" value={qrToken} />
      <input type="hidden" name="tip_percent" value={tipPercent} />

      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-white">{t('payment.chooseItems')}</h2>
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="text-xs text-cream-dim underline"
        >
          {t('payment.close')}
        </button>
      </div>
      <ul className="flex flex-col gap-2.5">
        {items.map((item) => (
          <li
            key={item.id}
            className={`flex flex-col gap-1.5 rounded-lg px-3.5 py-3 ${
              selected.has(item.id) ? 'bg-white/10' : 'bg-white/5'
            }`}
          >
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="h-4 w-4 accent-ember"
              />
              <span className="text-white">{item.name}</span>
              <span className="text-cream-dim">— {item.participantLabel}</span>
              <span className="ml-auto font-mono text-cream-dim">
                {t('payment.remaining', { amount: formatPrice(item.remainingCents, currency) })}
              </span>
            </label>
            {item.contributors.length > 0 && (
              <p className="ml-6 text-xs text-cream-dim">
                {t('payment.alreadyPaidBy', {
                  list: item.contributors
                    .map((c) => `${c.label} ${formatPrice(c.amountCents, currency)}`)
                    .join(', '),
                })}
              </p>
            )}
            {selected.has(item.id) && (
              <div className="ml-6 flex flex-col gap-1.5 text-xs text-cream-dim">
                {tableParticipants.filter((p) => p.id !== currentParticipantId).length > 0 && (
                  <>
                    <span>{t('payment.splitWithWho')}</span>
                    <div className="flex flex-wrap gap-1">
                      <span className="rounded-full border border-ember bg-ember px-2 py-0.5 text-ink">
                        {t('payment.you')}
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
                                  ? 'border-ember bg-ember text-ink'
                                  : 'border-white/15 text-cream-dim'
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
                <span className="font-mono text-ember-bright">
                  {shareCountFor(item.id) > 1
                    ? t('payment.splitBetweenN', { n: shareCountFor(item.id) })
                    : ''}
                  {t('payment.yourShare', { amount: formatPrice(myShareCents(item), currency) })}
                </span>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <span className="text-sm text-cream-dim">{t('payment.tip')}</span>
        {[0, 5, 10, 15].map((pct) => (
          <button
            key={pct}
            type="button"
            onClick={() => setTipPercent(pct)}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${
              tipPercent === pct
                ? 'border-ember bg-ember text-ink'
                : 'border-white/15 text-cream-dim'
            }`}
          >
            {pct}%
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-white/10 pt-3">
        <span className="text-sm">
          {t('payment.total')} <span className="font-mono text-ember-bright">{formatPrice(totalCents, currency)}</span>
        </span>
        <button
          type="submit"
          disabled={pending || selected.size === 0}
          className="rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-ink disabled:opacity-40"
        >
          {pending ? t('payment.redirecting') : t('payment.payTheseItems')}
        </button>
      </div>
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
    </form>
  )
}
