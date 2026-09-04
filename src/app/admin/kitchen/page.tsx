import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { KitchenBoard } from './kitchen-board'

function startOfTodayIso() {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.toISOString()
}

export default async function KitchenPage() {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  const [pendingOrders, deliveredToday] = await Promise.all([
    getRestaurantOrders(supabase, restaurant.id, { excludeStatus: 'delivered', ascending: true }),
    getRestaurantOrders(supabase, restaurant.id, { since: startOfTodayIso() }).then((orders) =>
      orders.filter((o) => o.status === 'delivered')
    ),
  ])

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Cocina — {restaurant.name}</h1>
      <KitchenBoard
        restaurantId={restaurant.id}
        currency={restaurant.currency}
        initialOrders={pendingOrders}
        initialDeliveredToday={deliveredToday}
      />
    </div>
  )
}
