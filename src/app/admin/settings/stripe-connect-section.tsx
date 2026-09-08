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
    <section className="flex max-w-sm flex-col gap-3 rounded-xl border border-marble-3 bg-white p-5">
      <h2 className="font-display text-lg text-ink">Cobros</h2>
      {connected ? (
        <>
          <p className="text-sm font-medium text-sage">✓ Cobros con Stripe activados</p>
          <form action={dashboardAction}>
            <button
              disabled={dashboardPending}
              type="submit"
              className="self-start rounded-lg border border-marble-3 px-4 py-2 text-sm text-bronze disabled:opacity-50"
            >
              {dashboardPending ? 'Abriendo…' : 'Gestionar cuenta de Stripe'}
            </button>
          </form>
          {dashboardState?.error && <p className="text-sm text-rust">{dashboardState.error}</p>}
        </>
      ) : (
        <>
          <p className="text-sm text-bronze">
            Conecta una cuenta de Stripe para que tus clientes puedan pagar la cuenta desde el móvil.
          </p>
          <form action={connectAction}>
            <button
              disabled={connectPending}
              type="submit"
              className="self-start rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {connectPending ? 'Conectando…' : 'Conectar con Stripe'}
            </button>
          </form>
          {connectState?.error && <p className="text-sm text-rust">{connectState.error}</p>}
        </>
      )}
    </section>
  )
}
