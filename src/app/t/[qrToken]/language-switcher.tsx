'use client'

import { useTransition } from 'react'
import { setDinerLocale } from '@/app/actions/locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/provider'

export function LanguageSwitcher() {
  const { locale } = useLocale()
  const [pending, startTransition] = useTransition()

  function change(next: Locale) {
    if (next === locale || pending) return
    const formData = new FormData()
    formData.set('locale', next)
    startTransition(async () => {
      await setDinerLocale(formData)
      window.location.reload()
    })
  }

  return (
    <div className="flex gap-1 self-center text-xs">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          disabled={pending}
          className={`rounded-full px-2.5 py-1 ${
            code === locale ? 'bg-ink text-white' : 'text-bronze hover:bg-marble-2'
          }`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  )
}
