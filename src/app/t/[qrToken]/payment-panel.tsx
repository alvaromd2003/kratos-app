'use client'

import { useActionState, useState } from 'react'
import { formatPrice } from '@/lib/format'
import {
  createIndividualPayment,
  createSplitPayment,
  createCollectivePayment,
  requestCashPayment,
} from '@/app/actions/payments'

export function PaymentPanel({
  qrToken,
  currency,
  remainingCents,
  individualDueCents,
  defaultShareCount,
  paymentResult,
  pendingCashAmountCents,
}: {
  qrToken: string
  currency: string
  remainingCents: number
  individualDueCents: number
  defaultShareCount: number
  paymentResult: 'success' | 'cancelled' | null
  pendingCashAmountCents: number | null
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

  if (remainingCents <= 0) {
    return (
      <div className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
        ✓ Cuenta pagada
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

      <form action={individualAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <span className="text-sm">Tu parte: {formatPrice(individualDueCents, currency)}</span>
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
          {splitPending ? 'Redirigiendo…' : formatPrice(Math.ceil(remainingCents / shareCount), currency)}
        </button>
      </form>
      {splitState?.error && <p className="text-xs text-red-600">{splitState.error}</p>}

      <form action={collectiveAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <span className="text-sm">Pagar toda la cuenta</span>
        <button
          type="submit"
          disabled={collectivePending}
          className="rounded bg-black px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          {collectivePending ? 'Redirigiendo…' : formatPrice(remainingCents, currency)}
        </button>
      </form>
      {collectiveState?.error && <p className="text-xs text-red-600">{collectiveState.error}</p>}

      <form action={cashAction} className="flex items-center justify-between gap-2">
        <input type="hidden" name="qr_token" value={qrToken} />
        <span className="text-sm">Pagar en efectivo (la cuenta completa)</span>
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
  )
}
