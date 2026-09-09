'use client'

import { useActionState } from 'react'
import { startStripeOnboarding, openStripeDashboard } from '@/app/actions/stripe-connect'
import { useLocale } from '@/lib/i18n/provider'

export function StripeConnectSection({ connected }: { connected: boolean }) {
  const { t } = useLocale()
  const [connectState, connectAction, connectPending] = useActionState(startStripeOnboarding, undefined)
  const [dashboardState, dashboardAction, dashboardPending] = useActionState(
    openStripeDashboard,
    undefined
  )

  return (
    <section className="flex max-w-sm flex-col gap-3 rounded-xl border border-marble-3 bg-white p-5">
      <h2 className="font-display text-lg text-ink">{t('settings.paymentsTitle')}</h2>
      {connected ? (
        <>
          <p className="text-sm font-medium text-sage">{t('settings.paymentsConnected')}</p>
          <form action={dashboardAction}>
            <button
              disabled={dashboardPending}
              type="submit"
              className="self-start rounded-lg border border-marble-3 px-4 py-2 text-sm text-bronze disabled:opacity-50"
            >
              {dashboardPending ? t('settings.opening') : t('settings.manageStripe')}
            </button>
          </form>
          {dashboardState?.errorCode && (
            <p className="text-sm text-rust">{t(`error.${dashboardState.errorCode}`, dashboardState.errorMessage ? { message: dashboardState.errorMessage } : undefined)}</p>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-bronze">
            {t('settings.connectIntro')}
          </p>
          <form action={connectAction}>
            <button
              disabled={connectPending}
              type="submit"
              className="self-start rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {connectPending ? t('settings.connecting') : t('settings.connectStripe')}
            </button>
          </form>
          {connectState?.errorCode && (
            <p className="text-sm text-rust">{t(`error.${connectState.errorCode}`, connectState.errorMessage ? { message: connectState.errorMessage } : undefined)}</p>
          )}
        </>
      )}
    </section>
  )
}
