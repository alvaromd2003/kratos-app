'use client'

import { closeTableSession } from '@/app/actions/tables'
import { recordManualPayment } from '@/app/actions/kitchen'
import { formatPrice } from '@/lib/format'
import type { TableZone } from '@/lib/table-zones'
import type { TableShape } from '@/lib/table-shapes'
import { AssistedOrderForm } from './assisted-order-form'

export const IDLE_THRESHOLD_MINUTES = 30

export type FloorTable = {
  id: string
  label: string
  zone: TableZone | null
  shape: TableShape
  occupied: boolean
  pendingCents: number
  lastActivityAt: string | null
  posX: number | null
  posY: number | null
}

// The badge/actions/assisted-order block for one table — shared by the
// plain list and the floor-plan popover so the two views can never drift
// out of sync with each other.
export function TableRowContent({
  table,
  currency,
  now,
  menuItems,
  expanded,
  onToggleAssisted,
}: {
  table: FloorTable
  currency: string
  now: number | null
  menuItems: { id: string; name: string; price_cents: number }[]
  expanded: boolean
  onToggleAssisted: () => void
}) {
  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">Mesa {table.label}</span>
        {table.occupied ? (
          <>
            <span className="rounded-full bg-rust px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
              Ocupada
            </span>
            {table.pendingCents > 0 && (
              <>
                <span className="font-mono text-xs text-ember">
                  Pendiente: {formatPrice(table.pendingCents, currency)}
                </span>
                <form
                  action={recordManualPayment}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        `¿Confirmas que ya has cobrado ${formatPrice(table.pendingCents, currency)} en efectivo o con datáfono en la mesa ${table.label}? Esto marca la cuenta como pagada — útil cuando nadie en la mesa ha usado el QR.`
                      )
                    ) {
                      e.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="table_id" value={table.id} />
                  <button type="submit" className="text-xs text-bronze underline">
                    Cobrado en efectivo/datáfono
                  </button>
                </form>
              </>
            )}
            {table.lastActivityAt &&
              now !== null &&
              (() => {
                const idleMinutes = Math.floor(
                  (now - new Date(table.lastActivityAt).getTime()) / 60_000
                )
                return idleMinutes >= IDLE_THRESHOLD_MINUTES ? (
                  <span className="text-xs text-ember">⏳ Sin actividad hace {idleMinutes} min</span>
                ) : null
              })()}
            <form
              action={closeTableSession}
              onSubmit={(e) => {
                const warning =
                  table.pendingCents > 0
                    ? `Quedan ${formatPrice(table.pendingCents, currency)} sin cobrar por la app en la mesa ${table.label} (puede que ya se haya cobrado en efectivo o con datáfono). ¿Cerrar de todas formas?`
                    : `¿Cerrar la mesa ${table.label}? Los clientes conectados tendrán que volver a escanear el código QR.`
                if (!confirm(warning)) {
                  e.preventDefault()
                }
              }}
            >
              <input type="hidden" name="table_id" value={table.id} />
              <button type="submit" className="text-xs text-bronze underline">
                Cerrar
              </button>
            </form>
          </>
        ) : (
          <span className="rounded-full bg-sage px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
            Libre
          </span>
        )}
        <button type="button" onClick={onToggleAssisted} className="text-xs text-bronze underline">
          Pedido asistido
        </button>
      </div>
      {expanded && <AssistedOrderForm tableId={table.id} currency={currency} menuItems={menuItems} />}
    </>
  )
}
