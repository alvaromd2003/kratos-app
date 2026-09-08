'use client'

import { useActionState } from 'react'
import { createTable } from '@/app/actions/tables'

export function AddTableForm() {
  const [state, action, pending] = useActionState(createTable, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="table-label" className="text-sm">
          Nueva mesa (nombre o número)
        </label>
        <input
          id="table-label"
          name="label"
          required
          placeholder="Mesa 5"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Añadiendo…' : 'Añadir mesa'}
      </button>
      {state?.error && <p className="text-sm text-rust">{state.error}</p>}
    </form>
  )
}
