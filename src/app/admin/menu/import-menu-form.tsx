'use client'

import { useActionState } from 'react'
import { bulkImportMenu } from '@/app/actions/menu'
import { useLocale } from '@/lib/i18n/provider'

export function ImportMenuForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(bulkImportMenu, undefined)

  return (
    <details className="rounded-xl border border-marble-3 bg-white p-4">
      <summary className="cursor-pointer font-display text-base text-ink">{t('menu.importTitle')}</summary>
      <form action={action} className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="import-file" className="text-sm">
            {t('menu.importFile')}
          </label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="text-sm"
          />
        </div>
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? t('menu.importing') : t('menu.importSubmit')}
        </button>
        <a href="/admin/menu/template" className="text-sm text-bronze underline">
          {t('menu.downloadTemplate')}
        </a>
      </form>
      {state?.errorCode && <p className="mt-2 text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
      {state?.created !== undefined && (
        <p className="mt-2 text-sm text-sage">
          {t('menu.importResult', { created: state.created, skipped: state.skipped ?? 0 })}
        </p>
      )}
    </details>
  )
}
