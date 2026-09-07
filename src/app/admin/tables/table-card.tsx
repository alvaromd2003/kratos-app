'use client'

import { useActionState } from 'react'
import { updateTable, deleteTable, closeTableSession, toggleTableActive } from '@/app/actions/tables'
import { formatPrice } from '@/lib/format'

export function TableCard({
  id,
  label,
  url,
  qrDataUrl,
  occupied,
  participantCount,
  active,
  pendingCents,
  currency,
}: {
  id: string
  label: string
  url: string
  qrDataUrl: string
  occupied: boolean
  participantCount: number
  active: boolean
  pendingCents: number
  currency: string
}) {
  const [state, action, pending] = useActionState(updateTable, undefined)
  const [deleteState, deleteAction] = useActionState(deleteTable, undefined)

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

      {!active && (
        <span className="rounded bg-gray-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Desactivada
        </span>
      )}

      {occupied ? (
        <div className="flex flex-col items-center gap-2">
          <span className="rounded bg-red-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Ocupada ({participantCount} {participantCount === 1 ? 'persona' : 'personas'})
          </span>
          {pendingCents > 0 && (
            <span className="text-xs text-amber-700">
              Pendiente: {formatPrice(pendingCents, currency)}
            </span>
          )}
          <form
            action={closeTableSession}
            onSubmit={(e) => {
              const warning =
                pendingCents > 0
                  ? `Quedan ${formatPrice(pendingCents, currency)} sin cobrar por la app en la mesa ${label} (puede que ya se haya cobrado en efectivo o con datáfono). ¿Cerrar de todas formas?`
                  : `¿Cerrar la mesa ${label}? Los clientes conectados tendrán que volver a escanear el código QR.`
              if (!confirm(warning)) {
                e.preventDefault()
              }
            }}
          >
            <input type="hidden" name="table_id" value={id} />
            <button type="submit" className="text-xs underline">
              Cerrar mesa
            </button>
          </form>
        </div>
      ) : (
        active && (
          <span className="rounded bg-green-600 px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Libre
          </span>
        )
      )}

      <form action={toggleTableActive}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={String(active)} />
        <button type="submit" className="text-xs underline">
          {active ? 'Desactivar' : 'Reactivar'}
        </button>
      </form>

      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(`¿Eliminar la mesa ${label}? Esto no se puede deshacer.`)) {
            e.preventDefault()
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-red-600 underline">
          Eliminar mesa
        </button>
      </form>
      {deleteState?.error && <p className="text-xs text-red-600">{deleteState.error}</p>}
    </li>
  )
}
