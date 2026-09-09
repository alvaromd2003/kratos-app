'use client'

import { useActionState } from 'react'
import { createMenuItem } from '@/app/actions/menu'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { useLocale } from '@/lib/i18n/provider'

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
  const { t } = useLocale()
  const [state, action, pending] = useActionState(createMenuItem, undefined)
  const visibleTags = DIETARY_TAGS.filter((tag) => enabledTags.includes(tag.value))

  return (
    <form
      action={action}
      className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="item-name">{t('menu.dishName')}</label>
        <input
          id="item-name"
          name="name"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-description">{t('menu.description')}</label>
        <input
          id="item-description"
          name="description"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="item-price">{t('menu.price')}</label>
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
          <label htmlFor="item-category">{t('menu.category')}</label>
          <select
            id="item-category"
            name="category_id"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
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
      {visibleTags.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-sm">{t('menu.allergensOptional')}</span>
          <div className="flex flex-wrap gap-3">
            {visibleTags.map((tag) => (
              <label key={tag.value} className="flex items-center gap-1 text-sm">
                <input type="checkbox" name="dietary_tags" value={tag.value} />
                {t(`dietary.${tag.value}`)}
              </label>
            ))}
          </div>
        </div>
      )}
      {existingItems.length > 0 && (
        <div className="flex flex-col gap-1">
          <label htmlFor="item-recommend">{t('menu.recommendWith')}</label>
          <select
            id="item-recommend"
            name="recommended_item_id"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          >
            <option value="">{t('menu.none')}</option>
            {existingItems.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
          <span className="text-xs text-bronze">
            {t('menu.recommendHint')}
          </span>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="item-available-from">{t('menu.availableFrom')}</label>
          <input
            id="item-available-from"
            name="available_from"
            type="time"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="item-available-until">{t('menu.availableUntil')}</label>
          <input
            id="item-available-until"
            name="available_until"
            type="time"
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="item-image">{t('menu.photoOptional')}</label>
        <input
          id="item-image"
          name="image"
          type="file"
          accept="image/*"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('common.adding') : t('menu.addDish')}
      </button>
    </form>
  )
}
