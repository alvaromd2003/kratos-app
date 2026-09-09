'use client'

import { useActionState } from 'react'
import { updateRestaurantProfile } from '@/app/actions/restaurant'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { OPTIONAL_PAYMENT_METHODS } from '@/lib/payment-methods'
import { useLocale } from '@/lib/i18n/provider'

const CURRENCIES = ['EUR', 'GBP', 'USD', 'AED']

export function SettingsForm({
  name,
  currency,
  enabledDietaryTags,
  enabledPaymentMethods,
  googleReviewUrl,
}: {
  name: string
  currency: string
  enabledDietaryTags: string[]
  enabledPaymentMethods: string[]
  googleReviewUrl: string | null
}) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(updateRestaurantProfile, undefined)

  return (
    <form
      action={action}
      className="flex max-w-sm flex-col gap-4 rounded-xl border border-marble-3 bg-white p-5"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="name">{t('settings.restaurantName')}</label>
        <input
          id="name"
          name="name"
          defaultValue={name}
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="currency">{t('settings.currency')}</label>
        <select
          id="currency"
          name="currency"
          defaultValue={currency}
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        >
          {CURRENCIES.map((code) => (
            <option key={code} value={code}>
              {t(`currency.${code}`)}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">{t('settings.dietaryTagsLabel')}</span>
        <div className="flex flex-wrap gap-3">
          {DIETARY_TAGS.map((tag) => (
            <label key={tag.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="enabled_dietary_tags"
                value={tag.value}
                defaultChecked={enabledDietaryTags.includes(tag.value)}
              />
              {t(`dietary.${tag.value}`)}
            </label>
          ))}
        </div>
        <span className="text-xs text-bronze">
          {t('settings.dietaryHint')}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm">{t('settings.paymentMethodsLabel')}</span>
        <div className="flex flex-wrap gap-3">
          {OPTIONAL_PAYMENT_METHODS.filter((m) => !m.euroOnly || currency === 'EUR').map((method) => (
            <label key={method.value} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                name="enabled_payment_methods"
                value={method.value}
                defaultChecked={enabledPaymentMethods.includes(method.value)}
              />
              {method.label}
            </label>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="google-review-url">{t('settings.googleReviewUrl')}</label>
        <input
          id="google-review-url"
          name="google_review_url"
          type="url"
          placeholder="https://g.page/r/..."
          defaultValue={googleReviewUrl ?? ''}
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
        <span className="text-xs text-bronze">
          {t('settings.googleReviewHint')}
        </span>
      </div>
      {state?.errorCode && <p className="text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('common.saving') : t('common.saveChanges')}
      </button>
    </form>
  )
}
