'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useWakeLock } from '@/lib/use-wake-lock'
import { updateTablePosition } from '@/app/actions/tables'
import { formatPrice } from '@/lib/format'
import { useLocale } from '@/lib/i18n/provider'
import { TABLE_ZONES, type TableZone } from '@/lib/table-zones'
import { TableRowContent, IDLE_THRESHOLD_MINUTES, type FloorTable } from './table-row-content'
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
  const { t } = useLocale()
  const [tables, setTables] = useState(initialTables)
  // Starts null (identical on server and on the client's first render) and
  // is only ever set from an effect, which runs client-side alone — a
  // useState(() => Date.now()) initializer here would run once during SSR
  // and again moments later during hydration, and if those two real
  // instants happened to straddle a minute boundary the idle-time text
  // would differ between them, which React reports as a hydration crash
  // rather than just a stale number (seen intermittently in testing).
  const [now, setNow] = useState<number | null>(null)
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null)
  const [view, setView] = useState<'list' | 'plan'>('list')
  const [zoneFilter, setZoneFilter] = useState<TableZone | 'all'>('all')
  const hasConnectedBefore = useRef(false)

  useWakeLock()

  // Forces a re-render every minute so "sin actividad hace N min" keeps
  // counting up even with no new data, and periodically re-pulls
  // lastActivityAt fresh from the server (see fetchTableState's comment
  // on why this can't just be Realtime).
  useEffect(() => {
    // Deferred rather than called directly in the effect body — same
    // client-only value, just scheduled as its own task instead of
    // running synchronously during the effect.
    const firstTick = setTimeout(() => setNow(Date.now()), 0)
    const tickInterval = setInterval(() => setNow(Date.now()), 60_000)
    const refreshInterval = setInterval(() => {
      const supabase = createClient()
      setTables((current) => {
        fetchTableState(supabase, restaurantId, current).then(setTables)
        return current
      })
    }, 120_000)
    return () => {
      clearTimeout(firstTick)
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
      // No restaurant_id filter possible (order_items has no such column
      // — see fetchTableState's comment), but RLS still only ever
      // delivers rows this restaurant's staff can actually SELECT, so
      // this can't leak another tenant's activity. Any new item, from
      // any table, means "mesa parada" should re-check freshness right
      // away instead of waiting for the 2-minute poll.
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_items' },
        () => {
          setTables((current) => {
            fetchTableState(supabase, restaurantId, current).then(setTables)
            return current
          })
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

  const hasAnyZone = tables.some((t) => t.zone !== null)
  const visibleTables =
    zoneFilter === 'all' ? tables : tables.filter((t) => t.zone === zoneFilter)
  const selectedTable = visibleTables.find((t) => t.id === selectedTableId) ?? null

  function toggleSelected(id: string) {
    setSelectedTableId((current) => (current === id ? null : id))
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg text-ink">{t('floor.tablesHeading')}</h2>
        <div className="flex gap-1 rounded-full border border-marble-3 bg-white p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setView('list')}
            className={`rounded-full px-3 py-1 ${view === 'list' ? 'bg-ink text-white' : 'text-bronze'}`}
          >
            {t('floor.viewList')}
          </button>
          <button
            type="button"
            onClick={() => setView('plan')}
            className={`rounded-full px-3 py-1 ${view === 'plan' ? 'bg-ink text-white' : 'text-bronze'}`}
          >
            {t('floor.viewPlan')}
          </button>
        </div>
      </div>

      {hasAnyZone && (
        <div className="flex flex-wrap gap-2 rounded-xl border border-marble-3 bg-white p-2">
          <button
            type="button"
            onClick={() => setZoneFilter('all')}
            className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
              zoneFilter === 'all' ? 'bg-ink text-white' : 'text-bronze hover:bg-marble-2'
            }`}
          >
            {t('floor.zoneAll')}
          </button>
          {TABLE_ZONES.map((zone) => (
            <button
              key={zone}
              type="button"
              onClick={() => setZoneFilter(zone)}
              className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors ${
                zoneFilter === zone ? 'bg-ink text-white' : 'text-bronze hover:bg-marble-2'
              }`}
            >
              {t(`zone.${zone}`)}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="lg:flex-1">
          {view === 'list' ? (
            <ul className="flex flex-col gap-2.5">
              {visibleTables.map((table) => {
                const idleMinutes =
                  table.lastActivityAt && now !== null
                    ? Math.floor((now - new Date(table.lastActivityAt).getTime()) / 60_000)
                    : null
                return (
                  <li key={table.id}>
                    <button
                      type="button"
                      onClick={() => toggleSelected(table.id)}
                      className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-4 text-left transition-colors ${
                        selectedTableId === table.id
                          ? 'border-ink bg-marble'
                          : 'border-marble-3 bg-white hover:bg-marble'
                      }`}
                    >
                      <span className="font-display text-lg text-ink">{t('common.table', { label: table.label })}</span>
                      <div className="flex flex-wrap items-center gap-2">
                        {idleMinutes !== null && idleMinutes >= IDLE_THRESHOLD_MINUTES && (
                          <span className="text-sm text-ember">{t('floor.idleMinutes', { n: idleMinutes })}</span>
                        )}
                        {table.pendingCents > 0 && (
                          <span className="font-mono text-sm text-ember">
                            {formatPrice(table.pendingCents, currency)}
                          </span>
                        )}
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-bold uppercase tracking-wide text-white ${
                            table.occupied ? 'bg-rust' : 'bg-sage'
                          }`}
                        >
                          {table.occupied ? t('floor.occupied') : t('floor.free')}
                        </span>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : (
            <FloorPlan
              tables={visibleTables}
              selectedId={selectedTableId}
              onSelect={setSelectedTableId}
              onPositionChange={handlePositionChange}
            />
          )}
        </div>

        {selectedTable && (
          <div className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-5 lg:sticky lg:top-4 lg:w-96">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-bronze">
                {t('floor.selectedTable')}
              </span>
              <button
                type="button"
                onClick={() => setSelectedTableId(null)}
                className="text-sm text-bronze underline"
              >
                {t('floor.close')}
              </button>
            </div>
            <TableRowContent
              key={selectedTable.id}
              table={selectedTable}
              currency={currency}
              now={now}
              menuItems={menuItems}
            />
          </div>
        )}
      </div>
    </section>
  )
}
