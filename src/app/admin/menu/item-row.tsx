'use client'

import { useActionState } from 'react'
import {
  updateMenuItem,
  deleteMenuItem,
  toggleMenuItemAvailability,
  moveMenuItem,
} from '@/app/actions/menu'
import { useActionSuccess } from '@/lib/use-action-success'
import { DIETARY_TAGS } from '@/lib/dietary-tags'

type Category = { id: string; name: string }
type Item = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  is_available: boolean
  dietary_tags: string[]
  recommended_item_id: string | null
}

export function ItemRow({
  item,
  categories,
  otherItems,
  isFirst,
  isLast,
}: {
  item: Item
  categories: Category[]
  otherItems: { id: string; name: string }[]
  isFirst: boolean
  isLast: boolean
}) {
  const [state, action, pending] = useActionState(updateMenuItem, undefined)
  const [deleteState, deleteAction] = useActionState(deleteMenuItem, undefined)

  // Inputs keep whatever the user typed either way (they're uncontrolled),
  // so without this there's no visible sign a save actually happened.
  const showSaved = useActionSuccess(pending, Boolean(state?.error))

  return (
    <li className="flex flex-col gap-3 rounded border border-gray-200 p-3">
      <div className="flex items-center gap-1">
        <form action={moveMenuItem}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={isFirst} className="text-xs disabled:opacity-30">
            ▲
          </button>
        </form>
        <form action={moveMenuItem}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={isLast} className="text-xs disabled:opacity-30">
            ▼
          </button>
        </form>
      </div>
      <form action={action} className="flex flex-col gap-2">
        <input type="hidden" name="id" value={item.id} />
        <div className="flex items-center gap-3">
          {item.image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              width={56}
              height={56}
              className="h-14 w-14 rounded object-cover"
            />
          )}
          <div className="flex flex-1 flex-wrap gap-2">
            <input
              name="name"
              defaultValue={item.name}
              required
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <input
              name="price"
              defaultValue={(item.price_cents / 100).toFixed(2)}
              required
              inputMode="decimal"
              className="w-20 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            <select
              name="category_id"
              defaultValue={item.category_id ?? ''}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
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
        <input
          name="description"
          defaultValue={item.description ?? ''}
          placeholder="Descripción (opcional)"
          className="rounded border border-gray-300 px-2 py-1 text-sm"
        />
        <div className="flex flex-wrap gap-3">
          {DIETARY_TAGS.map((tag) => (
            <label key={tag.value} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                name="dietary_tags"
                value={tag.value}
                defaultChecked={item.dietary_tags.includes(tag.value)}
              />
              {tag.label}
            </label>
          ))}
        </div>
        {otherItems.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`recommend-${item.id}`} className="text-xs text-gray-500">
              Recomendar junto con (opcional)
            </label>
            <select
              id={`recommend-${item.id}`}
              name="recommended_item_id"
              defaultValue={item.recommended_item_id ?? ''}
              className="rounded border border-gray-300 px-2 py-1 text-sm"
            >
              <option value="">Ninguno</option>
              {otherItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="text-xs text-gray-500">
          Cambiar foto (opcional)
          <input name="image" type="file" accept="image/*" className="mt-1 block text-xs" />
        </label>
        {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            type="submit"
            className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
          >
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {showSaved && <span className="text-xs text-green-600">Guardado ✓</span>}
          {!item.is_available && <span className="text-xs text-gray-400">(oculto)</span>}
        </div>
      </form>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <form action={toggleMenuItemAvailability}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="is_available" value={String(item.is_available)} />
            <button type="submit" className="text-xs underline">
              {item.is_available ? 'Ocultar' : 'Mostrar'}
            </button>
          </form>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(`¿Eliminar "${item.name}"? Esto no se puede deshacer.`)) {
                e.preventDefault()
              }
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="text-xs text-red-600 underline">
              Eliminar
            </button>
          </form>
        </div>
        {deleteState?.error && <p className="text-xs text-red-600">{deleteState.error}</p>}
      </div>
    </li>
  )
}
