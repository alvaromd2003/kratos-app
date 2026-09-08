'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWakeLock } from '@/lib/use-wake-lock'
import { updateTablePosition } from '@/app/actions/tables'
import { TableRowContent, type FloorTable } from './table-row-content'
import { FloorPlan } from './floor-plan'

type SessionRow = { table_id: string; status: 'open' | 'closed' }

// Refreshes occupancy AND last-activity together — same query shape as
// the server-side one in floor/page.tsx. Used both on realtime reconnect
// and on a periodic timer (order_items has no restaurant_id column to
// filter a Realtime channel on, so this can't just be pushed live).
async function fetchTableState(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  tables: FloorTable[]
): Promise<FloorTable[]> {
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
  menuItems,
}: {
  restaurantId: string
  initialTables: FloorTable[]
  currency: string
  menuItems: { id: string; name: string; price_cents: number }[]
}) {
  const [tables, setTables] = useState(initialTables)
  const [now, setNow] = useState(() => Date.now())
  const [expandedTableId, setExpandedTableId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'plan'>('list')
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

  // Optimistic: reflects immediately in this tab (the server round trip
  // to persist it happens in the background) rather than waiting on
  // revalidatePath, which wouldn't reach this component's own local
  // `tables` state anyway (it was seeded once from props, not re-synced).
  function handlePositionChange(id: string, x: number, y: number) {
    setTables((current) => current.map((t) => (t.id === id ? { ...t, posX: x, posY: y } : t)))
    updateTablePosition(id, x, y).catch(() => {})
  }

  if (tables.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">Mesas</h2>
        <div className="flex gap-1 rounded-full border border-marble-3 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-full px-3 py-1 ${view === 'list' ? 'bg-ink text-white' : 'text-bronze'}`}
          >
            Lista
          </button>
          <button
            type="button"
            onClick={() => setView('plan')}
            className={`rounded-full px-3 py-1 ${view === 'plan' ? 'bg-ink text-white' : 'text-bronze'}`}
          >
            Plano
          </button>
        </div>
      </div>

      {view === 'list' ? (
        <ul className="flex flex-wrap gap-3">
          {tables.map((table) => (
            <li
              key={table.id}
              className="flex flex-col gap-2 rounded-xl border border-marble-3 bg-white px-4 py-3 text-sm"
            >
              <TableRowContent
                table={table}
                currency={currency}
                now={now}
                menuItems={menuItems}
                expanded={expandedTableId === table.id}
                onToggleAssisted={() =>
                  setExpandedTableId((current) => (current === table.id ? null : table.id))
                }
              />
            </li>
          ))}
        </ul>
      ) : (
        <FloorPlan
          tables={tables}
          currency={currency}
          now={now}
          menuItems={menuItems}
          expandedTableId={expandedTableId}
          onToggleAssisted={setExpandedTableId}
          onPositionChange={handlePositionChange}
        />
      )}
    </section>
  )
}
