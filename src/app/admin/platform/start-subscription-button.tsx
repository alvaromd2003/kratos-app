'use client'

import { useActionState, useState } from 'react'
import { startRestaurantSubscription } from '@/app/actions/billing'

const ERROR_MESSAGES: Record<string, string> = {
  RESTAURANT_NOT_FOUND: 'Restaurante no encontrado.',
  ALREADY_SUBSCRIBED: 'Este restaurante ya tiene una suscripción.',
  STRIPE_CHECKOUT_FAILED: 'No se pudo crear el enlace de pago. Inténtalo de nuevo.',
}

export function StartSubscriptionButton({ restaurantId }: { restaurantId: string }) {
  const [state, action, pending] = useActionState(startRestaurantSubscription, undefined)
  const [copied, setCopied] = useState(false)

  if (state?.checkoutUrl) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={state.checkoutUrl}
            className="w-56 rounded border border-marble-3 bg-marble px-2 py-1 font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(state.checkoutUrl!)
              setCopied(true)
            }}
            className="rounded bg-ink px-2 py-1 text-xs font-medium text-white"
          >
            {copied ? 'Copiado ✓' : 'Copiar'}
          </button>
        </div>
        <span className="text-xs text-bronze">Mándaselo al restaurante — expira si no lo usan pronto.</span>
      </div>
    )
  }

  return (
    <form action={action}>
      <input type="hidden" name="restaurant_id" value={restaurantId} />
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ember px-3 py-1.5 text-xs font-semibold text-ink disabled:opacity-50"
      >
        {pending ? 'Generando…' : 'Iniciar suscripción'}
      </button>
      {state?.errorCode && (
        <p className="mt-1 text-xs text-rust">{ERROR_MESSAGES[state.errorCode] ?? 'Error desconocido.'}</p>
      )}
    </form>
  )
}
