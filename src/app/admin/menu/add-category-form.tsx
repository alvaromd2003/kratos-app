'use client'

import { useActionState } from 'react'
import { createCategory } from '@/app/actions/menu'

export function AddCategoryForm() {
  const [state, action, pending] = useActionState(createCategory, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-name" className="text-sm">
          Nueva categoría
        </label>
        <input
          id="cat-name"
          name="name"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-station" className="text-sm">
          Va a
        </label>
        <select
          id="cat-station"
          name="station"
          defaultValue="kitchen"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        >
          <option value="kitchen">Cocina</option>
          <option value="bar">Barra</option>
        </select>
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Añadiendo…' : 'Añadir'}
      </button>
      {state?.error && <p className="text-sm text-rust">{state.error}</p>}
    </form>
  )
}
