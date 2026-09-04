'use client'

import { useActionState } from 'react'
import { requestHelp } from '@/app/actions/ordering'
import { useActionSuccess } from '@/lib/use-action-success'

export function HelpButton({ qrToken }: { qrToken: string }) {
  const [state, action, pending] = useActionState(requestHelp, undefined)
  const sent = useActionSuccess(pending, Boolean(state?.error), 4000)

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="qr_token" value={qrToken} />
      <button
        type="submit"
        disabled={pending || sent}
        className="rounded border border-gray-300 px-3 py-1.5 text-sm disabled:opacity-50"
      >
        {pending ? 'Avisando…' : sent ? 'Camarero avisado ✓' : '🔔 Llamar al camarero'}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  )
}
