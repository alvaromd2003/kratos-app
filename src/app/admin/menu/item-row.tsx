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
import { useLocale } from '@/lib/i18n/provider'

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
  available_from: string | null
  available_until: string | null
}

export function ItemRow({
  item,
  categories,
  otherItems,
  enabledTags,
  isFirst,
  isLast,
}: {
  item: Item
  categories: Category[]
  otherItems: { id: string; name: string }[]
  enabledTags: string[]
  isFirst: boolean
  isLast: boolean
}) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(updateMenuItem, undefined)
  const [deleteState, deleteAction] = useActionState(deleteMenuItem, undefined)

  // Inputs keep whatever the user typed either way (they're uncontrolled),
  // so without this there's no visible sign a save actually happened.
  const showSaved = useActionSuccess(pending, Boolean(state?.errorCode))
  const visibleTags = DIETARY_TAGS.filter((tag) => enabledTags.includes(tag.value))

  return (
    <li className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-4">
      <div className="flex items-center gap-1">
        <form action={moveMenuItem}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={isFirst} className="text-xs text-bronze disabled:opacity-30">
            ▲
          </button>
        </form>
        <form action={moveMenuItem}>
          <input type="hidden" name="id" value={item.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={isLast} className="text-xs text-bronze disabled:opacity-30">
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
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          )}
          <div className="flex flex-1 flex-wrap gap-2">
            <input
              name="name"
              defaultValue={item.name}
              required
              className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            />
            <input
              name="price"
              defaultValue={(item.price_cents / 100).toFixed(2)}
              required
              inputMode="decimal"
              className="w-20 rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            />
            <select
              name="category_id"
              defaultValue={item.category_id ?? ''}
              className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            >
              <option value="">{t('menu.noCategory')}</option>
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
          placeholder={t('menu.description')}
          className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
        />
        <div className="flex flex-wrap gap-3">
          {visibleTags.map((tag) => (
            <label key={tag.value} className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                name="dietary_tags"
                value={tag.value}
                defaultChecked={item.dietary_tags.includes(tag.value)}
              />
              {t(`dietary.${tag.value}`)}
            </label>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-1 text-xs text-bronze">
            {t('menu.from')}
            <input
              name="available_from"
              type="time"
              defaultValue={item.available_from?.slice(0, 5) ?? ''}
              className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            />
          </label>
          <label className="flex items-center gap-1 text-xs text-bronze">
            {t('menu.until')}
            <input
              name="available_until"
              type="time"
              defaultValue={item.available_until?.slice(0, 5) ?? ''}
              className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            />
          </label>
        </div>
        {otherItems.length > 0 && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`recommend-${item.id}`} className="text-xs text-bronze">
              {t('menu.recommendWith')}
            </label>
            <select
              id={`recommend-${item.id}`}
              name="recommended_item_id"
              defaultValue={item.recommended_item_id ?? ''}
              className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
            >
              <option value="">{t('menu.none')}</option>
              {otherItems.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <label className="text-xs text-bronze">
          {t('menu.changePhoto')}
          <input name="image" type="file" accept="image/*" className="mt-1 block text-xs" />
        </label>
        {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
        <div className="flex items-center gap-3">
          <button
            disabled={pending}
            type="submit"
            className="rounded-lg bg-ink px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {pending ? t('common.saving') : t('common.saveChanges')}
          </button>
          {showSaved && <span className="text-xs text-sage">{t('common.saved')}</span>}
          {!item.is_available && <span className="text-xs text-bronze/70">{t('menu.hidden')}</span>}
          {item.available_from && item.available_until && (
            <span className="text-xs text-bronze/70">
              🕒 {item.available_from.slice(0, 5)}–{item.available_until.slice(0, 5)}
            </span>
          )}
        </div>
      </form>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <form action={toggleMenuItemAvailability}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="is_available" value={String(item.is_available)} />
            <button type="submit" className="text-xs text-bronze underline">
              {item.is_available ? t('menu.hide') : t('menu.show')}
            </button>
          </form>
          <form
            action={deleteAction}
            onSubmit={(e) => {
              if (!confirm(t('menu.deleteItemConfirm', { name: item.name }))) {
                e.preventDefault()
              }
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" className="text-xs text-rust underline">
              {t('common.delete')}
            </button>
          </form>
        </div>
        {deleteState?.errorCode && <p className="text-xs text-rust">{t(`error.${deleteState.errorCode}`)}</p>}
      </div>
    </li>
  )
}
