'use client'

import { useActionState } from 'react'
import { sendOrderToKitchen } from '@/app/actions/ordering'

export function SendOrderButton({ qrToken }: { qrToken: string }) {
  const [state, action, pending] = useActionState(sendOrderToKitchen, undefined)

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="qr_token" value={qrToken} />
      {state?.error && <p className="text-xs text-rust">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Enviando…' : 'Enviar pedido a cocina'}
      </button>
    </form>
  )
}
