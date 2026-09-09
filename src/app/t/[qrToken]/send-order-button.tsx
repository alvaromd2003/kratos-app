'use client'

import { useActionState } from 'react'
import { sendOrderToKitchen } from '@/app/actions/ordering'
import { useLocale } from '@/lib/i18n/provider'

export function SendOrderButton({ qrToken }: { qrToken: string }) {
  const [state, action, pending] = useActionState(sendOrderToKitchen, undefined)
  const { t } = useLocale()

  return (
    <form action={action} className="flex flex-col gap-1">
      <input type="hidden" name="qr_token" value={qrToken} />
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? t('cart.sending') : t('cart.send')}
      </button>
    </form>
  )
}
