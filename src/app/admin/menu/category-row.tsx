'use client'

import { useActionState } from 'react'
import { updateCategory, deleteCategory, moveCategory } from '@/app/actions/menu'
import { useLocale } from '@/lib/i18n/provider'

export function CategoryRow({
  id,
  name,
  station,
  isFirst,
  isLast,
}: {
  id: string
  name: string
  station: string
  isFirst: boolean
  isLast: boolean
}) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(updateCategory, undefined)

  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-marble-3 bg-white px-4 py-3">
      <div className="flex items-center gap-1.5">
        <form action={moveCategory}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={isFirst} className="text-xs text-bronze disabled:opacity-30">
            ▲
          </button>
        </form>
        <form action={moveCategory}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={isLast} className="text-xs text-bronze disabled:opacity-30">
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
          className="w-32 rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
        />
        <select
          name="station"
          defaultValue={station}
          className="rounded-lg border border-marble-3 px-2 py-1 text-sm focus:border-ember focus:outline-none"
        >
          <option value="kitchen">{t('station.kitchen')}</option>
          <option value="bar">{t('station.bar')}</option>
        </select>
        <button disabled={pending} type="submit" className="text-xs text-bronze underline">
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
      <form action={deleteCategory}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-rust underline">
          {t('common.delete')}
        </button>
      </form>
    </li>
  )
}
