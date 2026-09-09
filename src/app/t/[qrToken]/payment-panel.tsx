'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import {
  createIndividualPayment,
  createSplitPayment,
  createCollectivePayment,
  requestCashPayment,
} from '@/app/actions/payments'
import { useLocale } from '@/lib/i18n/provider'
import { FeedbackPanel } from './feedback-panel'

export function PaymentPanel({
  qrToken,
  currency,
  tableTotalCents,
  remainingCents,
  individualDueCents,
  defaultShareCount,
  paymentResult,
  pendingCashAmountCents,
  hasSubmittedFeedback,
  googleReviewUrl,
  loyaltyDiscountPercent,
  myPaidCents,
}: {
  qrToken: string
  currency: string
  tableTotalCents: number
  remainingCents: number
  individualDueCents: number
  defaultShareCount: number
  paymentResult: 'success' | 'cancelled' | null
  pendingCashAmountCents: number | null
  hasSubmittedFeedback: boolean
  googleReviewUrl: string | null
  loyaltyDiscountPercent: number
  myPaidCents: number
}) {
  const { t } = useLocale()
  const [individualState, individualAction, individualPending] = useActionState(
    createIndividualPayment,
    undefined
  )
  const [splitState, splitAction, splitPending] = useActionState(createSplitPayment, undefined)
  const [collectiveState, collectiveAction, collectivePending] = useActionState(
    createCollectivePayment,
    undefined
  )
  const [cashState, cashAction, cashPending] = useActionState(requestCashPayment, undefined)
  const [shareCount, setShareCount] = useState(Math.max(1, defaultShareCount))
  const [tipPercent, setTipPercent] = useState(0)

  // Mirrors exactly what createPaymentCheckout computes server-side
  // (src/app/actions/payments.ts): discount and tip both come off the
  // same base amount, never compounded — so the number shown here is
  // never a surprise once the diner reaches Stripe.
  const withDiscountAndTip = (baseCents: number) => {
    const discountCents = Math.round((baseCents * loyaltyDiscountPercent) / 100)
    const tipCents = Math.round((baseCents * tipPercent) / 100)
    return baseCents - discountCents + tipCents
  }

  // Nothing ordered yet also computes as "0 pendiente" — that must not
  // look like a paid bill (and definitely shouldn't ask for a rating).
  // Only a table that actually had a total, now fully covered, counts.
  if (tableTotalCents <= 0) {
    return null
  }

  if (remainingCents <= 0) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-sage-bg bg-sage-bg p-4">
        <p className="text-sm font-medium text-sage">{t('payment.paid')}</p>
        <FeedbackPanel
          qrToken={qrToken}
          hasSubmittedFeedback={hasSubmittedFeedback}
          googleReviewUrl={googleReviewUrl}
        />
      </div>
    )
  }

  // Waiting on staff to physically receive the cash and confirm it — hide
  // every other payment option meanwhile so nobody double-pays while it's
  // pending (see confirmCashPayment/rejectCashPayment in actions/kitchen.ts).
  if (pendingCashAmountCents !== null) {
    return (
      <section className="flex flex-col gap-2 rounded border border-amber-200 bg-amber-50 p-3">
        <h2 className="font-medium">{t('payment.title')}</h2>
        <p className="text-sm text-amber-800">
          {t('payment.cashPendingNotice', {
            amount: formatPrice(pendingCashAmountCents, currency),
          })}
        </p>
      </section>
    )
  }

  return (
    <>
      {myPaidCents > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-sage-bg bg-sage-bg p-4">
          <p className="text-sm font-medium text-sage">{t('payment.myPartPaid')}</p>
          <FeedbackPanel
            qrToken={qrToken}
            hasSubmittedFeedback={hasSubmittedFeedback}
            googleReviewUrl={googleReviewUrl}
          />
        </div>
      )}
      <section className="flex flex-col gap-4 rounded-2xl bg-ink px-5 py-5 text-marble-2">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-lg text-white">{t('payment.title')}</h2>
          <p className="font-mono text-sm text-cream-dim">
            {t('payment.pending', { amount: formatPrice(remainingCents, currency) })}
          </p>
        </div>

        {paymentResult === 'success' && (
          <p className="text-sm text-ember-bright">{t('payment.success')}</p>
        )}
        {paymentResult === 'cancelled' && (
          <p className="text-sm text-cream-dim">{t('payment.cancelled')}</p>
        )}

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

        <form action={individualAction} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3.5 py-2.5">
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="tip_percent" value={tipPercent} />
          <span className="text-sm">
            {t('payment.myPart')}{' '}
            <span className="font-mono text-ember-bright">
              {formatPrice(withDiscountAndTip(individualDueCents), currency)}
            </span>
          </span>
          <button
            type="submit"
            disabled={individualPending || individualDueCents <= 0}
            className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            {individualPending ? t('payment.redirecting') : t('payment.payMyPart')}
          </button>
        </form>
        {individualState?.errorCode && (
          <p className="text-xs text-rust">{t(`error.${individualState.errorCode}`)}</p>
        )}

        <form action={splitAction} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3.5 py-2.5">
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="tip_percent" value={tipPercent} />
          <label className="flex items-center gap-2 text-sm">
            {t('payment.splitBetween')}
            <input
              type="number"
              name="share_count"
              min={1}
              value={shareCount}
              onChange={(e) => setShareCount(Math.max(1, Number(e.target.value) || 1))}
              className="w-14 rounded border border-white/15 bg-transparent px-2 py-1 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={splitPending}
            className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            {splitPending
              ? t('payment.redirecting')
              : formatPrice(withDiscountAndTip(Math.ceil(remainingCents / shareCount)), currency)}
          </button>
        </form>
        {splitState?.errorCode && (
          <p className="text-xs text-rust">{t(`error.${splitState.errorCode}`)}</p>
        )}

        <form action={collectiveAction} className="flex items-center justify-between gap-3 rounded-lg bg-white/5 px-3.5 py-2.5">
          <input type="hidden" name="qr_token" value={qrToken} />
          <input type="hidden" name="tip_percent" value={tipPercent} />
          <span className="text-sm">{t('payment.payWholeBill')}</span>
          <button
            type="submit"
            disabled={collectivePending}
            className="rounded-lg bg-ember px-3 py-1.5 text-sm font-medium text-ink disabled:opacity-40"
          >
            {collectivePending ? t('payment.redirecting') : formatPrice(withDiscountAndTip(remainingCents), currency)}
          </button>
        </form>
        {collectiveState?.errorCode && (
          <p className="text-xs text-rust">{t(`error.${collectiveState.errorCode}`)}</p>
        )}

        <form action={cashAction} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 px-3.5 py-2.5">
          <input type="hidden" name="qr_token" value={qrToken} />
          <span className="text-sm text-cream-dim">
            {t('payment.payCash')}{' '}
            <span className="font-mono">
              {formatPrice(
                remainingCents - Math.round((remainingCents * loyaltyDiscountPercent) / 100),
                currency
              )}
            </span>{' '}
            {t('payment.payCashNote')}
          </span>
          <button
            type="submit"
            disabled={cashPending}
            className="rounded-lg border border-white/20 px-3 py-1.5 text-sm text-marble-2 disabled:opacity-40"
          >
            {cashPending ? t('payment.notifying') : t('payment.notifyStaff')}
          </button>
        </form>
        {cashState?.errorCode && <p className="text-xs text-rust">{t(`error.${cashState.errorCode}`)}</p>}
      </section>
    </>
  )
}
