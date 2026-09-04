'use client'

import { useActionState, useState } from 'react'
import { addItemToCart } from '@/app/actions/ordering'
import { useActionSuccess } from '@/lib/use-action-success'
import { formatPrice } from '@/lib/format'

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
  const justAdded = useActionSuccess(pending, Boolean(state?.error))
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false)
  const [, suggestionAction] = useActionState(addItemToCart, undefined)

  const showSuggestion = justAdded && recommendedItem && !dismissedSuggestion

  return (
    <div className="flex flex-col items-end gap-1">
      <form action={action}>
        <input type="hidden" name="qr_token" value={qrToken} />
        <input type="hidden" name="menu_item_id" value={menuItemId} />
        <button
          type="submit"
          disabled={pending}
          className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
        >
          {pending ? 'Añadiendo…' : 'Añadir'}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {showSuggestion && recommendedItem && (
        <div className="flex items-center gap-1 rounded border border-gray-300 bg-gray-50 px-2 py-1 text-xs">
          <span>
            ¿Añades {recommendedItem.name} ({formatPrice(recommendedItem.price_cents, currency)})?
          </span>
          <form action={suggestionAction} onSubmit={() => setDismissedSuggestion(true)}>
            <input type="hidden" name="qr_token" value={qrToken} />
            <input type="hidden" name="menu_item_id" value={recommendedItem.id} />
            <button type="submit" className="font-medium underline">
              Sí
            </button>
          </form>
          <button type="button" onClick={() => setDismissedSuggestion(true)} className="underline">
            No
          </button>
        </div>
      )}
    </div>
  )
}
