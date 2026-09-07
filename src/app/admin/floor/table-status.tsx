'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { closeTableSession } from '@/app/actions/tables'
import { useWakeLock } from '@/lib/use-wake-lock'
import { formatPrice } from '@/lib/format'

type Table = {
  id: string
  label: string
  occupied: boolean
  pendingCents: number
  lastActivityAt: string | null
}
type SessionRow = { table_id: string; status: 'open' | 'closed' }

const IDLE_THRESHOLD_MINUTES = 30

// Refreshes occupancy AND last-activity together — same query shape as
// the server-side one in floor/page.tsx. Used both on realtime reconnect
// and on a periodic timer (order_items has no restaurant_id column to
// filter a Realtime channel on, so this can't just be pushed live).
async function fetchTableState(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  tables: Table[]
): Promise<Table[]> {
  const { data: openSessions } = await supabase
    .from('table_sessions')
    .select('id, table_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')

  const sessionList = openSessions ?? []
  const occupiedTableIds = new Set(sessionList.map((s) => s.table_id))
  const sessionIdByTableId = new Map(sessionList.map((s) => [s.table_id, s.id]))

  const sessionIds = sessionList.map((s) => s.id)
  const { data: recentItems } =
    sessionIds.length > 0
      ? await supabase
          .from('order_items')
          .select('table_session_id, created_at')
          .in('table_session_id', sessionIds)
      : { data: [] }

  const lastActivityBySessionId = new Map(sessionList.map((s) => [s.id, s.created_at]))
  for (const item of recentItems ?? []) {
    const current = lastActivityBySessionId.get(item.table_session_id)
    if (!current || item.created_at > current) {
      lastActivityBySessionId.set(item.table_session_id, item.created_at)
    }
  }

  return tables.map((t) => {
    const sessionId = sessionIdByTableId.get(t.id)
    return {
      ...t,
      occupied: occupiedTableIds.has(t.id),
      lastActivityAt: sessionId ? (lastActivityBySessionId.get(sessionId) ?? null) : null,
    }
  })
}

export function TableStatus({
  restaurantId,
  initialTables,
  currency,
}: {
  restaurantId: string
  initialTables: Table[]
  currency: string
}) {
  const [tables, setTables] = useState(initialTables)
  const [now, setNow] = useState(() => Date.now())
  const hasConnectedBefore = useRef(false)

  useWakeLock()

  // Forces a re-render every minute so "sin actividad hace N min" keeps
  // counting up even with no new data, and periodically re-pulls
  // lastActivityAt fresh from the server (see fetchTableState's comment
  // on why this can't just be Realtime).
  useEffect(() => {
    const tickInterval = setInterval(() => setNow(Date.now()), 60_000)
    const refreshInterval = setInterval(() => {
      const supabase = createClient()
      setTables((current) => {
        fetchTableState(supabase, restaurantId, current).then(setTables)
        return current
      })
    }, 120_000)
    return () => {
      clearInterval(tickInterval)
      clearInterval(refreshInterval)
    }
  }, [restaurantId])

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`table-status-${restaurantId}`)
      .on<SessionRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as SessionRow
          setTables((current) =>
            current.map((t) =>
              t.id === row.table_id
                ? { ...t, occupied: true, pendingCents: 0, lastActivityAt: new Date().toISOString() }
                : t
            )
          )
        }
      )
      .on<SessionRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as SessionRow
          if (row.status !== 'closed') return
          setTables((current) =>
            current.map((t) => (t.id === row.table_id ? { ...t, occupied: false } : t))
          )
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        setTables((current) => {
          fetchTableState(supabase, restaurantId, current).then(setTables)
          return current
        })
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  if (tables.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Mesas</h2>
      <ul className="flex flex-wrap gap-3">
        {tables.map((table) => (
          <li
            key={table.id}
            className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <span className="font-medium">Mesa {table.label}</span>
            {table.occupied ? (
              <>
                <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  Ocupada
                </span>
                {table.pendingCents > 0 && (
                  <span className="text-xs text-amber-700">
                    Pendiente: {formatPrice(table.pendingCents, currency)}
                  </span>
                )}
                {table.lastActivityAt &&
                  (() => {
                    const idleMinutes = Math.floor(
                      (now - new Date(table.lastActivityAt).getTime()) / 60_000
                    )
                    return idleMinutes >= IDLE_THRESHOLD_MINUTES ? (
                      <span className="text-xs text-orange-600">
                        ⏳ Sin actividad hace {idleMinutes} min
                      </span>
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
                  <button type="submit" className="text-xs underline">
                    Cerrar
                  </button>
                </form>
              </>
            ) : (
              <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                Libre
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
