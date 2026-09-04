import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { KitchenBoard, type KitchenOrder } from './kitchen-board'

export default async function KitchenPage() {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  const { data: orders } = await supabase
    .from('orders')
    .select('id, table_session_id, status, created_at')
    .eq('restaurant_id', restaurant.id)
    .neq('status', 'delivered')
    .order('created_at', { ascending: true })

  const orderList = orders ?? []

  const sessionIds = [...new Set(orderList.map((o) => o.table_session_id))]
  const orderIds = orderList.map((o) => o.id)

  const [{ data: sessions }, { data: orderItems }] = await Promise.all([
    sessionIds.length > 0
      ? supabase.from('table_sessions').select('id, table_id').in('id', sessionIds)
      : Promise.resolve({ data: [] }),
    orderIds.length > 0
      ? supabase
          .from('order_items')
          .select('id, order_id, quantity, menu_item_id, participant_id')
          .in('order_id', orderIds)
      : Promise.resolve({ data: [] }),
  ])

  const sessionList = sessions ?? []
  const tableIds = [...new Set(sessionList.map((s) => s.table_id))]
  const itemList = orderItems ?? []
  const menuItemIds = [...new Set(itemList.map((i) => i.menu_item_id))]
  const participantIds = [...new Set(itemList.map((i) => i.participant_id))]

  const [{ data: tables }, { data: menuItems }, { data: participants }] = await Promise.all([
    tableIds.length > 0
      ? supabase.from('tables').select('id, label').in('id', tableIds)
      : Promise.resolve({ data: [] }),
    menuItemIds.length > 0
      ? supabase.from('menu_items').select('id, name').in('id', menuItemIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase.from('session_participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] }),
  ])

  const tableLabelById = new Map((tables ?? []).map((t) => [t.id, t.label]))
  const tableIdBySession = new Map(sessionList.map((s) => [s.id, s.table_id]))
  const menuItemNameById = new Map((menuItems ?? []).map((m) => [m.id, m.name]))
  const participantNameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  const initialOrders: KitchenOrder[] = orderList.map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    tableLabel: tableLabelById.get(tableIdBySession.get(order.table_session_id) ?? '') ?? '—',
    items: itemList
      .filter((item) => item.order_id === order.id)
      .map((item) => ({
        id: item.id,
        quantity: item.quantity,
        dishName: menuItemNameById.get(item.menu_item_id) ?? '—',
        participantName: participantNameById.get(item.participant_id) ?? '—',
      })),
  }))

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Cocina — {restaurant.name}</h1>
      <KitchenBoard restaurantId={restaurant.id} initialOrders={initialOrders} />
    </div>
  )
}
