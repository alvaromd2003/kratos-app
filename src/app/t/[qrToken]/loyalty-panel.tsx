'use client'

import { useActionState } from 'react'
import { setLoyaltyEmail } from '@/app/actions/loyalty'

const STAMP_THRESHOLD = 10

export function LoyaltyPanel({
  qrToken,
  loyaltyEmail,
  stamps,
}: {
  qrToken: string
  loyaltyEmail: string | null
  stamps: number
}) {
  const [state, action, pending] = useActionState(setLoyaltyEmail, undefined)

  if (!loyaltyEmail) {
    return (
      <form action={action} className="flex items-center gap-2 rounded border border-gray-200 p-3">
        <input type="hidden" name="qr_token" value={qrToken} />
        <input
          type="email"
          name="email"
          placeholder="tu@email.com"
          required
          className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded border border-gray-400 px-3 py-1 text-sm disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Acumular sellos'}
        </button>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      </form>
    )
  }

  return (
    <div className="rounded border border-gray-200 p-3 text-sm">
      Sellos: {stamps}/{STAMP_THRESHOLD}
      {stamps >= STAMP_THRESHOLD && (
        <span className="ml-2 text-green-700">
          🎉 Descuento disponible — se aplicará solo en tu próximo pago
        </span>
      )}
    </div>
  )
}
