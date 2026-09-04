'use client'

import { useActionState } from 'react'
import { createMenuItem } from '@/app/actions/menu'

type Category = { id: string; name: string }

export function AddItemForm({ categories }: { categories: Category[] }) {
  const [state, action, pending] = useActionState(createMenuItem, undefined)

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded border border-gray-200 p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="item-name">Nombre del plato</label>
        <input
          id="item-name"
          name="name"
          required
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-description">Descripción (opcional)</label>
        <input
          id="item-description"
          name="description"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="item-price">Precio (€)</label>
          <input
            id="item-price"
            name="price"
            required
            inputMode="decimal"
            placeholder="9.50"
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="item-category">Categoría (opcional)</label>
          <select
            id="item-category"
            name="category_id"
            className="rounded border border-gray-300 px-3 py-2"
          >
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-image">Foto (opcional)</label>
        <input
          id="item-image"
          name="image"
          type="file"
          accept="image/*"
          className="rounded border border-gray-300 px-3 py-2"
        />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="self-start rounded bg-black px-4 py-2 text-white disabled:opacity-50"
      >
        {pending ? 'Añadiendo…' : 'Añadir plato'}
      </button>
    </form>
  )
}
