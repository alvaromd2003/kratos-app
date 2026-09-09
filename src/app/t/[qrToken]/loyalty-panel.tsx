'use client'

import { useActionState } from 'react'
import { setLoyaltyEmail } from '@/app/actions/loyalty'
import { useLocale } from '@/lib/i18n/provider'

const STAMP_THRESHOLD = 10

export function LoyaltyPanel({
  qrToken,
  loyaltyEmail,
  stamps,
}: {
  qrToken: string
  loyaltyEmail: string | null
  stamps: number
}) {
  const [state, action, pending] = useActionState(setLoyaltyEmail, undefined)
  const { t } = useLocale()

  if (!loyaltyEmail) {
    return (
      <form
        action={action}
        className="flex items-center gap-2 rounded-xl border border-marble-3 bg-white p-3"
      >
        <input type="hidden" name="qr_token" value={qrToken} />
        <input
          type="email"
          name="email"
          placeholder={t('loyalty.emailPlaceholder')}
          required
          className="flex-1 rounded-lg border border-marble-3 px-3 py-2 text-sm text-ink focus:border-ember focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending}
          className="whitespace-nowrap rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? t('loyalty.saving') : t('loyalty.join')}
        </button>
        {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
      </form>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-marble-3 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-bronze">{t('loyalty.stampsCollected')}</span>
        <span className="font-mono text-xs text-bronze">
          {stamps}/{STAMP_THRESHOLD}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: STAMP_THRESHOLD }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${i < stamps ? 'bg-ember' : 'bg-marble-3'}`}
          />
        ))}
      </div>
      {stamps >= STAMP_THRESHOLD && (
        <span className="text-xs font-medium text-sage">{t('loyalty.discountAvailable')}</span>
      )}
    </div>
  )
}
