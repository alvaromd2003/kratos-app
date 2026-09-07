'use client'

import { useActionState } from 'react'
import { updateRestaurantProfile } from '@/app/actions/restaurant'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { OPTIONAL_PAYMENT_METHODS } from '@/lib/payment-methods'

const CURRENCIES = [
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'Libra (£)' },
  { code: 'USD', label: 'Dólar ($)' },
  { code: 'AED', label: 'Dirham EAU (AED)' },
]

export function SettingsForm({
  name,
  currency,
  enabledDietaryTags,
  enabledPaymentMethods,
}: {
  name: string
  currency: string
  enabledDietaryTags: string[]
  enabledPaymentMethods: string[]
}) {
  const [state, action, pending] = useActionState(updateRestaurantProfile, undefined)

  return (
    <form action={action} className="flex max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nombre del restaurante</label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="currency">Moneda</label>
        <select
          id="currency"
          name="currency"
          defaultValue={currency}
          className="rounded border border-gray-300 px-3 py-2"
        >
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">Etiquetas de alérgenos/dieta que usáis</span>
        <div className="flex flex-wrap gap-3">
          {DIETARY_TAGS.map((tag) => (
            <label key={tag.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="enabled_dietary_tags"
                value={tag.value}
                defaultChecked={enabledDietaryTags.includes(tag.value)}
              />
              {tag.label}
            </label>
          ))}
        </div>
        <span className="text-xs text-gray-500">
          Solo las que marques aquí aparecerán al crear/editar platos y para que el cliente filtre.
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">Métodos de pago (además de tarjeta, siempre activa)</span>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_PAYMENT_METHODS.filter((m) => !m.euroOnly || currency === 'EUR').map((method) => (
            <label key={method.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="enabled_payment_methods"
                value={method.value}
                defaultChecked={enabledPaymentMethods.includes(method.value)}
              />
              {method.label}
            </label>
          ))}
        </div>
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  )
}
