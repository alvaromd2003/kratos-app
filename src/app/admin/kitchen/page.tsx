import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { startOfTodayIso } from '@/lib/timezone'
import { KitchenBoard } from './kitchen-board'
import { TableStatus } from './table-status'

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
        .select('table_id')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'open'),
    ])

  const occupiedTableIds = new Set((openSessions ?? []).map((s) => s.table_id))
  const initialTables = (tables ?? []).map((t) => ({
    id: t.id,
    label: t.label,
    occupied: occupiedTableIds.has(t.id),
  }))

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Cocina — {restaurant.name}</h1>

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
