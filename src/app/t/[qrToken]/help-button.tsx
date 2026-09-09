'use client'

import { useActionState } from 'react'
import { requestHelp } from '@/app/actions/ordering'
import { useActionSuccess } from '@/lib/use-action-success'
import { useLocale } from '@/lib/i18n/provider'

export function HelpButton({ qrToken }: { qrToken: string }) {
  const [state, action, pending] = useActionState(requestHelp, undefined)
  const sent = useActionSuccess(pending, Boolean(state?.errorCode), 4000)
  const { t } = useLocale()

  return (
    <form action={action} className="flex flex-col items-start gap-1">
      <input type="hidden" name="qr_token" value={qrToken} />
      <button
        type="submit"
        disabled={pending || sent}
        className="self-start rounded-full border border-ember/30 bg-ember/10 px-3.5 py-1.5 text-sm text-ember-bright disabled:opacity-50"
      >
        {pending ? t('table.callingWaiter') : sent ? t('table.waiterCalled') : t('table.callWaiter')}
      </button>
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
    </form>
  )
}
