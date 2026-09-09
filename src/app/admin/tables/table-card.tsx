'use client'

import { useActionState } from 'react'
import { updateTable, deleteTable, closeTableSession, toggleTableActive } from '@/app/actions/tables'
import { recordManualPayment } from '@/app/actions/kitchen'
import { formatPrice } from '@/lib/format'
import { TABLE_ZONES, TABLE_ZONE_LABELS, type TableZone } from '@/lib/table-zones'
import { TABLE_SHAPES, TABLE_SHAPE_LABELS, type TableShape } from '@/lib/table-shapes'

export function TableCard({
  id,
  label,
  zone,
  shape,
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
  zone: TableZone | null
  shape: TableShape
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
    <li className="flex w-56 flex-col items-center gap-2.5 rounded-xl border border-marble-3 bg-white p-4 text-center">
      <form action={action} className="flex flex-col items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          key={`label-${label}`}
          name="label"
          defaultValue={label}
          required
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        />
        <select
          key={`zone-${zone ?? 'none'}`}
          name="zone"
          defaultValue={zone ?? ''}
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        >
          <option value="">Sin zona</option>
          {TABLE_ZONES.map((z) => (
            <option key={z} value={z}>
              {TABLE_ZONE_LABELS[z]}
            </option>
          ))}
        </select>
        <select
          key={`shape-${shape}`}
          name="shape"
          defaultValue={shape}
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        >
          {TABLE_SHAPES.map((s) => (
            <option key={s} value={s}>
              {TABLE_SHAPE_LABELS[s]}
            </option>
          ))}
        </select>
        <button disabled={pending} type="submit" className="text-xs text-bronze underline">
          {pending ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
      {state?.error && <p className="text-xs text-rust">{state.error}</p>}
      <div className="rounded-lg border border-marble-3 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={`Código QR de ${label}`} width={200} height={200} />
      </div>
      <a
        href={qrDataUrl}
        download={`mesa-${label}-kratos.png`}
        className="text-xs text-bronze underline"
      >
        Descargar QR en alta resolución
      </a>
      <p className="break-all text-xs text-bronze">{url}</p>

      {!active && (
        <span className="rounded-full bg-bronze px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          Desactivada
        </span>
      )}

      {occupied ? (
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-rust px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Ocupada ({participantCount} {participantCount === 1 ? 'persona' : 'personas'})
          </span>
          {pendingCents > 0 && (
            <>
              <span className="font-mono text-xs text-ember">
                Pendiente: {formatPrice(pendingCents, currency)}
              </span>
              <form
                action={recordManualPayment}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      `¿Confirmas que ya has cobrado ${formatPrice(pendingCents, currency)} en efectivo o con datáfono en la mesa ${label}? Esto marca la cuenta como pagada — útil cuando nadie en la mesa ha usado el QR.`
                    )
                  ) {
                    e.preventDefault()
                  }
                }}
              >
                <input type="hidden" name="table_id" value={id} />
                <button type="submit" className="text-xs text-bronze underline">
                  Cobrado en efectivo/datáfono
                </button>
              </form>
            </>
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
            <button type="submit" className="text-xs text-bronze underline">
              Cerrar mesa
            </button>
          </form>
        </div>
      ) : (
        active && (
          <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            Libre
          </span>
        )
      )}

      <form action={toggleTableActive}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={String(active)} />
        <button type="submit" className="text-xs text-bronze underline">
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
        <button type="submit" className="text-xs text-rust underline">
          Eliminar mesa
        </button>
      </form>
      {deleteState?.error && <p className="text-xs text-rust">{deleteState.error}</p>}
    </li>
  )
}
