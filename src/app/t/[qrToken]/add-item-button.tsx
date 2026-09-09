'use client'

import { useActionState, useState } from 'react'
import { addItemToCart } from '@/app/actions/ordering'
import { useActionSuccess } from '@/lib/use-action-success'
import { formatPrice } from '@/lib/format'
import { useLocale } from '@/lib/i18n/provider'

type RecommendedItem = { id: string; name: string; price_cents: number }

export function AddItemButton({
  qrToken,
  menuItemId,
  recommendedItem,
  currency,
}: {
  qrToken: string
  menuItemId: string
  recommendedItem: RecommendedItem | null
  currency: string
}) {
  const [state, action, pending] = useActionState(addItemToCart, undefined)
  const justAdded = useActionSuccess(pending, Boolean(state?.errorCode))
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false)
  const [, suggestionAction] = useActionState(addItemToCart, undefined)
  const { t } = useLocale()

  const showSuggestion = justAdded && recommendedItem && !dismissedSuggestion

  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="menu_item_id" value={menuItemId} />
        <button
          type="submit"
          disabled={pending}
          aria-label="+"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-lg leading-none text-ember-bright disabled:opacity-50"
        >
          {pending ? '…' : '+'}
        </button>
      </form>
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
      {showSuggestion && recommendedItem && (
        <div className="flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs">
          <span>
            {t('cart.addSuggestion', {
              name: recommendedItem.name,
              price: formatPrice(recommendedItem.price_cents, currency),
            })}
          </span>
          <form action={suggestionAction} onSubmit={() => setDismissedSuggestion(true)}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="menu_item_id" value={recommendedItem.id} />
            <button type="submit" className="font-medium underline">
              {t('cart.yes')}
            </button>
          </form>
          <button type="button" onClick={() => setDismissedSuggestion(true)} className="underline">
            {t('cart.no')}
          </button>
        </div>
      )}
    </div>
  )
}
