'use client'

import { useActionState } from 'react'
import { addItemToCart } from '@/app/actions/ordering'

export function AddItemButton({ qrToken, menuItemId }: { qrToken: string; menuItemId: string }) {
  const [state, action, pending] = useActionState(addItemToCart, undefined)

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="qr_token" value={qrToken} />
      <input type="hidden" name="menu_item_id" value={menuItemId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-black px-3 py-1 text-xs text-white disabled:opacity-50"
      >
        {pending ? 'Añadiendo…' : 'Añadir'}
      </button>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
    </form>
  )
}
