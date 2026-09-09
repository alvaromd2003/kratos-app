'use client'

import { useTransition } from 'react'
import { setStaffLocale } from '@/app/actions/locale'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/config'
import { useLocale } from '@/lib/i18n/provider'

export function StaffLanguageSwitcher() {
  const { locale } = useLocale()
  const [pending, startTransition] = useTransition()

  function change(next: Locale) {
    if (next === locale || pending) return
    const formData = new FormData()
    formData.set('locale', next)
    startTransition(async () => {
      await setStaffLocale(formData)
      window.location.reload()
    })
  }

  return (
    <div className="flex gap-1 text-xs">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          disabled={pending}
          className={`rounded-full px-2.5 py-1 ${
            code === locale ? 'bg-ember/20 text-ember-bright' : 'text-cream-dim hover:bg-white/5'
          }`}
        >
          {LOCALE_LABELS[code]}
        </button>
      ))}
    </div>
  )
}
