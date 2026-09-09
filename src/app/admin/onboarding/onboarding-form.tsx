'use client'

import { useActionState } from 'react'
import { createRestaurant } from '@/app/actions/restaurant'
import { useLocale } from '@/lib/i18n/provider'

export function OnboardingForm({ needsAccessCode }: { needsAccessCode: boolean }) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(createRestaurant, undefined)

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name">{t('onboarding.restaurantName')}</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      {needsAccessCode && (
        <div className="flex flex-col gap-1">
          <label htmlFor="access_code">{t('onboarding.accessCode')}</label>
          <input
            id="access_code"
            name="access_code"
            type="text"
            required
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
          <span className="text-xs text-bronze">{t('onboarding.accessCodeHint')}</span>
        </div>
      )}
      {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('onboarding.creating') : t('onboarding.create')}
      </button>
    </form>
  )
}
