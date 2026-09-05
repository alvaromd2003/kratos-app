import 'server-only'
import type { createClient } from '@/lib/supabase/server'

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>
type Station = 'kitchen' | 'bar'

export type OrderDetail = {
  id: string
  status: 'pending' | 'preparing' | 'ready' | 'delivered'
  createdAt: string
  cancellationRequestedAt: string | null
  tableLabel: string
  items: {
    id: string
    quantity: number
    dishName: string
    priceCents: number
    participantName: string
    station: Station
    note: string | null
  }[]
}

// Shared by the kitchen board, the bar/floor board, and the history page —
// all need "orders for this restaurant, with their table's label and each
// item's dish/price/who ordered/which station preps it" — just with
// different status filters and ordering.
export async function getRestaurantOrders(
  supabase: SupabaseServerClient,
  restaurantId: string,
  options?: {
    excludeStatus?: OrderDetail['status']
    statuses?: OrderDetail['status'][]
    ascending?: boolean
    since?: string
    /** Keyset pagination cursor: only orders strictly before this timestamp. */
    before?: string
    limit?: number
  }
): Promise<OrderDetail[]> {
  let query = supabase
    .from('orders')
    .select('id, table_session_id, status, created_at, cancellation_requested_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: options?.ascending ?? false })

  if (options?.excludeStatus) {
    query = query.neq('status', options.excludeStatus)
  }
  if (options?.statuses) {
    query = query.in('status', options.statuses)
  }
  if (options?.since) {
    query = query.gte('created_at', options.since)
  }
  if (options?.before) {
    query = query.lt('created_at', options.before)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data: orders } = await query
  const orderList = orders ?? []
  if (orderList.length === 0) return []

  const sessionIds = [...new Set(orderList.map((o) => o.table_session_id))]
  const orderIds = orderList.map((o) => o.id)

  const [{ data: sessions }, { data: orderItems }] = await Promise.all([
    supabase.from('table_sessions').select('id, table_id').in('id', sessionIds),
    supabase
      .from('order_items')
      .select('id, order_id, quantity, menu_item_id, participant_id, note')
      .in('order_id', orderIds),
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
      ? supabase.from('menu_items').select('id, name, price_cents, category_id').in('id', menuItemIds)
      : Promise.resolve({ data: [] }),
    participantIds.length > 0
      ? supabase.from('session_participants').select('id, name').in('id', participantIds)
      : Promise.resolve({ data: [] }),
  ])

  const menuItemList = menuItems ?? []
  const categoryIds = [...new Set(menuItemList.map((m) => m.category_id).filter((id): id is string => !!id))]
  const { data: categories } =
    categoryIds.length > 0
      ? await supabase.from('menu_categories').select('id, station').in('id', categoryIds)
      : { data: [] }

  const stationByCategoryId = new Map((categories ?? []).map((c) => [c.id, c.station as Station]))
  const tableLabelById = new Map((tables ?? []).map((t) => [t.id, t.label]))
  const tableIdBySession = new Map(sessionList.map((s) => [s.id, s.table_id]))
  const menuItemById = new Map(menuItemList.map((m) => [m.id, m]))
  const participantNameById = new Map((participants ?? []).map((p) => [p.id, p.name]))

  return orderList.map((order) => ({
    id: order.id,
    status: order.status,
    createdAt: order.created_at,
    cancellationRequestedAt: order.cancellation_requested_at,
    tableLabel: tableLabelById.get(tableIdBySession.get(order.table_session_id) ?? '') ?? '—',
    items: itemList
      .filter((item) => item.order_id === order.id)
      .map((item) => {
        const menuItem = menuItemById.get(item.menu_item_id)
        const station = menuItem?.category_id
          ? (stationByCategoryId.get(menuItem.category_id) ?? 'kitchen')
          : 'kitchen'
        return {
          id: item.id,
          quantity: item.quantity,
          dishName: menuItem?.name ?? '—',
          priceCents: menuItem?.price_cents ?? 0,
          participantName: participantNameById.get(item.participant_id) ?? '—',
          station,
          note: item.note,
        }
      }),
  }))
}
