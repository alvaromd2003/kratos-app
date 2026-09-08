'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import {
  createIndividualPayment,
  createSplitPayment,
  createCollectivePayment,
  requestCashPayment,
} from '@/app/actions/payments'
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
      <div className="flex flex-col gap-3 rounded border border-green-200 bg-green-50 p-3">
        <p className="text-sm text-green-700">✓ Cuenta pagada</p>
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
        <h2 className="font-medium">Pagar la cuenta</h2>
        <p className="text-sm text-amber-800">
          Avisado al personal para pagar {formatPrice(pendingCashAmountCents, currency)} en
          efectivo — esperando que confirmen que lo han recibido.
        </p>
      </section>
    )
  }

  return (
    <>
      {myPaidCents > 0 && (
        <div className="flex flex-col gap-3 rounded border border-green-200 bg-green-50 p-3">
          <p className="text-sm text-green-700">✓ Ya has pagado tu parte</p>
          <FeedbackPanel
            qrToken={qrToken}
            hasSubmittedFeedback={hasSubmittedFeedback}
            googleReviewUrl={googleReviewUrl}
          />
        </div>
      )}
      <section className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">Pagar la cuenta</h2>
        <p className="text-sm text-gray-600">Pendiente: {formatPrice(remainingCents, currency)}</p>
      </div>

      {paymentResult === 'success' && (
        <p className="text-sm text-green-700">
          Pago recibido — puede tardar unos segundos en reflejarse aquí.
        </p>
      )}
      {paymentResult === 'cancelled' && (
        <p className="text-sm text-gray-500">Pago cancelado. Puedes intentarlo de nuevo.</p>
      )}

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

      <form action={individualAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="tip_percent" value={tipPercent} />
        <span className="text-sm">Tu parte: {formatPrice(withDiscountAndTip(individualDueCents), currency)}</span>
        <button
          type="submit"
          disabled={individualPending || individualDueCents <= 0}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {individualPending ? 'Redirigiendo…' : 'Pagar mi parte'}
        </button>
      </form>
      {individualState?.error && <p className="text-xs text-red-600">{individualState.error}</p>}

      <form action={splitAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="tip_percent" value={tipPercent} />
        <label className="flex items-center gap-2 text-sm">
          Dividir entre
          <input
            type="number"
            name="share_count"
            min={1}
            value={shareCount}
            onChange={(e) => setShareCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-14 rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <button
          type="submit"
          disabled={splitPending}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {splitPending
            ? 'Redirigiendo…'
            : formatPrice(withDiscountAndTip(Math.ceil(remainingCents / shareCount)), currency)}
        </button>
      </form>
      {splitState?.error && <p className="text-xs text-red-600">{splitState.error}</p>}

      <form action={collectiveAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="tip_percent" value={tipPercent} />
        <span className="text-sm">Pagar toda la cuenta</span>
        <button
          type="submit"
          disabled={collectivePending}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {collectivePending ? 'Redirigiendo…' : formatPrice(withDiscountAndTip(remainingCents), currency)}
        </button>
      </form>
      {collectiveState?.error && <p className="text-xs text-red-600">{collectiveState.error}</p>}

      <form action={cashAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <span className="text-sm">
          Pagar en efectivo:{' '}
          {formatPrice(
            remainingCents - Math.round((remainingCents * loyaltyDiscountPercent) / 100),
            currency
          )}{' '}
          (la cuenta completa)
        </span>
        <button
          type="submit"
          disabled={cashPending}
          className="rounded border border-gray-400 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {cashPending ? 'Avisando…' : 'Avisar al personal'}
        </button>
      </form>
      {cashState?.error && <p className="text-xs text-red-600">{cashState.error}</p>}
      </section>
    </>
  )
}
