'use client'

import { useActionState } from 'react'
import Image from 'next/image'
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-display text-3xl text-ink">{restaurantName}</h1>
        <p className="text-bronze">Mesa {tableLabel}</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="qr_token" value={qrToken} />
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm text-bronze">
            ¿Cómo te llamas?
          </label>
          <input
            id="name"
            name="name"
            type="text"
            required
            autoFocus
            maxLength={40}
            className="rounded-lg border border-marble-3 px-3.5 py-2.5 text-ink focus:border-ember focus:outline-none"
          />
        </div>
        {state?.error && <p className="text-sm text-rust">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Entrando…' : 'Entrar y pedir'}
        </button>
      </form>
      <a
        href={`/t/${qrToken}?browse=1`}
        className="text-center text-sm text-bronze underline underline-offset-2"
      >
        Ver el menú sin unirme
      </a>
      <p className="flex items-center justify-center gap-1.5 text-center text-[0.68rem] tracking-wide text-bronze/70">
        <Image src="/kratos-badge.png" alt="" width={40} height={40} className="h-3.5 w-3.5 rounded-[3px]" />
        Con la tecnología de Kratos Systems
      </p>
    </main>
  )
}
