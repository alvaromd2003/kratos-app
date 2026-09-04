import { redirect } from 'next/navigation'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { startOfTodayIso } from '@/lib/timezone'
import { KitchenBoard } from './kitchen-board'

export default async function KitchenPage() {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role === 'waiter') {
    redirect('/admin/floor')
  }

  const supabase = await createClient()

  const [pendingOrders, deliveredToday] = await Promise.all([
    getRestaurantOrders(supabase, restaurant.id, {
      statuses: ['pending', 'preparing'],
      ascending: true,
    }),
    getRestaurantOrders(supabase, restaurant.id, { since: startOfTodayIso() }).then((orders) =>
      orders.filter((o) => o.status === 'delivered')
    ),
  ])

  return (
    <div className="flex flex-col gap-8">
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
