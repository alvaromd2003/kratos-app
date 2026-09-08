'use client'

import { useActionState } from 'react'
import { createRestaurant } from '@/app/actions/restaurant'

export function OnboardingForm() {
  const [state, action, pending] = useActionState(createRestaurant, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name">Nombre del restaurante</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-rust">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Creando…' : 'Crear restaurante'}
      </button>
    </form>
  )
}
