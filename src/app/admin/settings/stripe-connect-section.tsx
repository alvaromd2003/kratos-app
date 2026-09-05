'use client'

import { useActionState } from 'react'
import { startStripeOnboarding, openStripeDashboard } from '@/app/actions/stripe-connect'

export function StripeConnectSection({ connected }: { connected: boolean }) {
  const [connectState, connectAction, connectPending] = useActionState(startStripeOnboarding, undefined)
  const [dashboardState, dashboardAction, dashboardPending] = useActionState(
    openStripeDashboard,
    undefined
  )

  return (
    <section className="flex max-w-sm flex-col gap-3">
      <h2 className="font-medium">Cobros</h2>
      {connected ? (
        <>
          <p className="text-sm text-green-700">✓ Cobros con Stripe activados</p>
          <form action={dashboardAction}>
            <button
              disabled={dashboardPending}
              type="submit"
              className="self-start rounded border border-gray-300 px-4 py-2 text-sm disabled:opacity-50"
            >
              {dashboardPending ? 'Abriendo…' : 'Gestionar cuenta de Stripe'}
            </button>
          </form>
          {dashboardState?.error && <p className="text-sm text-red-600">{dashboardState.error}</p>}
        </>
      ) : (
        <>
          <p className="text-sm text-gray-600">
            Conecta una cuenta de Stripe para que tus clientes puedan pagar la cuenta desde el móvil.
          </p>
          <form action={connectAction}>
            <button
              disabled={connectPending}
              type="submit"
              className="self-start rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {connectPending ? 'Conectando…' : 'Conectar con Stripe'}
            </button>
          </form>
          {connectState?.error && <p className="text-sm text-red-600">{connectState.error}</p>}
        </>
      )}
    </section>
  )
}
