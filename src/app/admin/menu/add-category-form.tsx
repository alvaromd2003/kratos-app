'use client'

import { useActionState } from 'react'
import { createCategory } from '@/app/actions/menu'
import { useLocale } from '@/lib/i18n/provider'

export function AddCategoryForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(createCategory, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="cat-name" className="text-sm">
          {t('menu.newCategory')}
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
          {t('menu.goesTo')}
        </label>
        <select
          id="cat-station"
          name="station"
          defaultValue="kitchen"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        >
          <option value="kitchen">{t('station.kitchen')}</option>
          <option value="bar">{t('station.bar')}</option>
        </select>
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('common.adding') : t('common.add')}
      </button>
      {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
    </form>
  )
}
