'use client'

import { useActionState } from 'react'
import { updateTable, deleteTable } from '@/app/actions/tables'

export function TableCard({
  id,
  label,
  url,
  qrDataUrl,
}: {
  id: string
  label: string
  url: string
  qrDataUrl: string
}) {
  const [state, action, pending] = useActionState(updateTable, undefined)

  return (
    <li className="flex w-56 flex-col items-center gap-2 rounded border border-gray-200 p-4 text-center">
      <form action={action} className="flex items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          name="label"
          defaultValue={label}
          required
          className="w-28 rounded border border-gray-300 px-2 py-1 text-center text-sm"
        />
        <button disabled={pending} type="submit" className="text-xs underline">
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      {state?.error && <p className="text-xs text-red-600">{state.error}</p>}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrDataUrl} alt={`Código QR de ${label}`} width={200} height={200} />
      <p className="break-all text-xs text-gray-500">{url}</p>
      <form action={deleteTable}>
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-red-600 underline">
          Eliminar mesa
        </button>
      </form>
    </li>
  )
}
