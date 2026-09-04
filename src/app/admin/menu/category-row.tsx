'use client'

import { useActionState } from 'react'
import { updateCategory, deleteCategory, moveCategory } from '@/app/actions/menu'

export function CategoryRow({
  id,
  name,
  isFirst,
  isLast,
}: {
  id: string
  name: string
  isFirst: boolean
  isLast: boolean
}) {
  const [state, action, pending] = useActionState(updateCategory, undefined)

  return (
    <li className="flex flex-col gap-1 rounded border border-gray-300 px-3 py-2">
      <div className="flex items-center gap-1">
        <form action={moveCategory}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={isFirst} className="text-xs disabled:opacity-30">
            ▲
          </button>
        </form>
        <form action={moveCategory}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={isLast} className="text-xs disabled:opacity-30">
            ▼
          </button>
        </form>
      </div>
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="name"
          defaultValue={name}
          required
          className="w-32 rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <button disabled={pending} type="submit" className="text-xs underline">
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      <form action={deleteCategory}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-red-600 underline">
          Eliminar
        </button>
      </form>
    </li>
  )
}
