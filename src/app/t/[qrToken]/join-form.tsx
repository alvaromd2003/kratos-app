'use client'

import { useActionState } from 'react'
import { joinTable } from '@/app/actions/ordering'

export function JoinForm({
  qrToken,
  tableLabel,
  restaurantName,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
}) {
  const [state, action, pending] = useActionState(joinTable, undefined)

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold">{restaurantName}</h1>
        <p className="text-gray-600">Mesa {tableLabel}</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="qr_token" value={qrToken} />
        <div className="flex flex-col gap-1">
          <label htmlFor="name">¿Cómo te llamas?</label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            maxLength={40}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded bg-ink px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Entrando…' : 'Entrar y pedir'}
        </button>
      </form>
      <a href={`/t/${qrToken}?browse=1`} className="text-center text-sm underline">
        Ver el menú sin unirme
      </a>
    </main>
  )
}
