'use client'

import { useActionState } from 'react'
import { createMenuItem } from '@/app/actions/menu'
import { DIETARY_TAGS } from '@/lib/dietary-tags'

type Category = { id: string; name: string }
type ExistingItem = { id: string; name: string }

export function AddItemForm({
  categories,
  existingItems,
  enabledTags,
}: {
  categories: Category[]
  existingItems: ExistingItem[]
  enabledTags: string[]
}) {
  const [state, action, pending] = useActionState(createMenuItem, undefined)
  const visibleTags = DIETARY_TAGS.filter((tag) => enabledTags.includes(tag.value))

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="item-name">Nombre del plato</label>
        <input
          id="item-name"
          name="name"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-description">Descripción (opcional)</label>
        <input
          id="item-description"
          name="description"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
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
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="item-category">Categoría (opcional)</label>
          <select
            id="item-category"
            name="category_id"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
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
      {visibleTags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm">Alérgenos / dieta (opcional)</span>
          <div className="flex flex-wrap gap-3">
            {visibleTags.map((tag) => (
              <label key={tag.value} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="dietary_tags" value={tag.value} />
                {tag.label}
              </label>
            ))}
          </div>
        </div>
      )}
      {existingItems.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="item-recommend">Recomendar junto con (opcional)</label>
          <select
            id="item-recommend"
            name="recommended_item_id"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          >
            <option value="">Ninguno</option>
            {existingItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-bronze">
            Al cliente le aparecerá &quot;¿Añades también X?&quot; después de pedir este plato.
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="item-available-from">Disponible desde (opcional)</label>
          <input
            id="item-available-from"
            name="available_from"
            type="time"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="item-available-until">Disponible hasta (opcional)</label>
          <input
            id="item-available-until"
            name="available_until"
            type="time"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-image">Foto (opcional)</label>
        <input
          id="item-image"
          name="image"
          type="file"
          accept="image/*"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      {state?.error && <p className="text-sm text-rust">{state.error}</p>}
      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Añadiendo…' : 'Añadir plato'}
      </button>
    </form>
  )
}
