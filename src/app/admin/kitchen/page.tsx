import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { startOfTodayIso } from '@/lib/timezone'
import { KitchenBoard } from './kitchen-board'
import { TableStatus } from './table-status'
import { HelpAlerts } from './help-alerts'

export default async function KitchenPage() {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  const [pendingOrders, deliveredToday, { data: tables }, { data: openSessions }] =
    await Promise.all([
      getRestaurantOrders(supabase, restaurant.id, { excludeStatus: 'delivered', ascending: true }),
      getRestaurantOrders(supabase, restaurant.id, { since: startOfTodayIso() }).then((orders) =>
        orders.filter((o) => o.status === 'delivered')
      ),
      supabase
        .from('tables')
        .select('id, label')
        .eq('restaurant_id', restaurant.id)
        .eq('active', true)
        .order('created_at'),
      supabase
        .from('table_sessions')
        .select('id, table_id')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'open'),
    ])

  const sessionList = openSessions ?? []
  const tableLabelById = new Map((tables ?? []).map((t) => [t.id, t.label]))
  const tableLabelBySessionId = new Map(
    sessionList.map((s) => [s.id, tableLabelById.get(s.table_id) ?? '—'])
  )

  const occupiedTableIds = new Set(sessionList.map((s) => s.table_id))
  const initialTables = (tables ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    occupied: occupiedTableIds.has(t.id),
  }))

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

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Cocina — {restaurant.name}</h1>

      <HelpAlerts
        restaurantId={restaurant.id}
        initialRequests={initialHelpRequests}
        tableLabelBySessionId={Object.fromEntries(tableLabelBySessionId)}
      />

      <TableStatus restaurantId={restaurant.id} initialTables={initialTables} />

      <KitchenBoard
        restaurantId={restaurant.id}
        currency={restaurant.currency}
        initialOrders={pendingOrders}
        initialDeliveredToday={deliveredToday}
      />
    </div>
  )
}
