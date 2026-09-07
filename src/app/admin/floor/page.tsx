import { redirect } from 'next/navigation'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { getTableBillSummary } from '@/lib/payments'
import { TableStatus } from './table-status'
import { HelpAlerts } from './help-alerts'
import { ReadyOrders } from './ready-orders'
import { CashPaymentAlerts } from './cash-payment-alerts'

export default async function FloorPage() {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role === 'kitchen_staff') {
    redirect('/admin/kitchen')
  }

  const supabase = await createClient()

  const [readyOrders, { data: tables }, { data: openSessions }] = await Promise.all([
    getRestaurantOrders(supabase, restaurant.id, { statuses: ['ready'], ascending: true }),
    supabase
      .from('tables')
      .select('id, label')
      .eq('restaurant_id', restaurant.id)
      .eq('active', true)
      .order('created_at'),
    supabase
      .from('table_sessions')
      .select('id, table_id, created_at')
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'open'),
  ])

  const sessionList = openSessions ?? []
  const tableLabelById = new Map((tables ?? []).map((t) => [t.id, t.label]))
  const tableLabelBySessionId = new Map(
    sessionList.map((s) => [s.id, tableLabelById.get(s.table_id) ?? '—'])
  )

  const sessionIdByTableId = new Map(sessionList.map((s) => [s.table_id, s.id]))
  const pendingCentsBySessionId = new Map(
    await Promise.all(
      sessionList.map(async (s) => {
        const summary = await getTableBillSummary(supabase, s.id)
        return [s.id, summary.remainingCents] as const
      })
    )
  )

  // Last activity per session, for the "mesa parada" nudge — a single
  // bulk query (not one per table) of every open session's order_items,
  // reduced client-side to the freshest created_at per session. Falls
  // back to the session's own created_at if nothing's been ordered yet.
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

  const initialTables = (tables ?? []).map((t) => {
    const sessionId = sessionIdByTableId.get(t.id)
    return {
      id: t.id,
      label: t.label,
      occupied: sessionId !== undefined,
      pendingCents: sessionId !== undefined ? (pendingCentsBySessionId.get(sessionId) ?? 0) : 0,
      lastActivityAt: sessionId !== undefined ? (lastActivityBySessionId.get(sessionId) ?? null) : null,
    }
  })

  const { data: helpRequests } = await supabase
    .from('help_requests')
    .select('id, table_session_id, created_at')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  const initialHelpRequests = (helpRequests ?? []).map((h) => ({
    id: h.id,
    tableSessionId: h.table_session_id,
    tableLabel: tableLabelBySessionId.get(h.table_session_id) ?? '—',
    createdAt: h.created_at,
  }))

  const { data: cashRequests } = await supabase
    .from('payment_shares')
    .select('id, table_session_id, charged_cents, created_at')
    .eq('restaurant_id', restaurant.id)
    .eq('mode', 'cash')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const initialCashRequests = (cashRequests ?? []).map((c) => ({
    id: c.id,
    tableSessionId: c.table_session_id,
    tableLabel: tableLabelBySessionId.get(c.table_session_id) ?? '—',
    amountCents: c.charged_cents,
    createdAt: c.created_at,
  }))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Barra — {restaurant.name}</h1>

      <HelpAlerts
        restaurantId={restaurant.id}
        initialRequests={initialHelpRequests}
        tableLabelBySessionId={Object.fromEntries(tableLabelBySessionId)}
      />

      <CashPaymentAlerts
        restaurantId={restaurant.id}
        initialRequests={initialCashRequests}
        tableLabelBySessionId={Object.fromEntries(tableLabelBySessionId)}
        currency={restaurant.currency}
      />

      <ReadyOrders restaurantId={restaurant.id} initialOrders={readyOrders} />

      <TableStatus
        restaurantId={restaurant.id}
        initialTables={initialTables}
        currency={restaurant.currency}
      />
    </div>
  )
}
