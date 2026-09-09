'use client'

import { useActionState } from 'react'
import { createTable } from '@/app/actions/tables'
import { TABLE_ZONES } from '@/lib/table-zones'
import { TABLE_SHAPES } from '@/lib/table-shapes'
import { useLocale } from '@/lib/i18n/provider'

export function AddTableForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(createTable, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="table-label" className="text-sm">
          {t('tables.newTable')}
        </label>
        <input
          id="table-label"
          name="label"
          required
          placeholder={t('tables.labelPlaceholder')}
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="table-zone" className="text-sm">
          {t('tables.zoneOptional')}
        </label>
        <select
          id="table-zone"
          name="zone"
          defaultValue=""
          className="rounded-lg border border-marble-3 px-3 py-2.5 focus:border-ember focus:outline-none"
        >
          <option value="">{t('tables.noZone')}</option>
          {TABLE_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {t(`zone.${zone}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="table-shape" className="text-sm">
          {t('tables.shape')}
        </label>
        <select
          id="table-shape"
          name="shape"
          defaultValue="round"
          className="rounded-lg border border-marble-3 px-3 py-2.5 focus:border-ember focus:outline-none"
        >
          {TABLE_SHAPES.map((shape) => (
            <option key={shape} value={shape}>
              {t(`shape.${shape}`)}
            </option>
          ))}
        </select>
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('common.adding') : t('tables.addTable')}
      </button>
      {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
    </form>
  )
}
