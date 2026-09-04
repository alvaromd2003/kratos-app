import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getOpenSessionParticipant } from '@/lib/ordering'
import { JoinForm } from './join-form'
import { LiveTable } from './live-table'

export default async function TableOrderPage({
  params,
}: {
  params: Promise<{ qrToken: string }>
}) {
  const { qrToken } = await params

  const table = await getActiveTableByQrToken(qrToken)
  if (!table) {
    notFound()
  }

  const admin = createAdminClient()
  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name, currency')
    .eq('id', table.restaurant_id)
    .single()

  if (!restaurant) {
    notFound()
  }

  const cookieStore = await cookies()
  const raw = cookieStore.get(`td_${qrToken}`)?.value
  const [participantId, tableSessionId] = raw?.split(':') ?? []

  const verified =
    participantId && tableSessionId
      ? await getOpenSessionParticipant(table.id, tableSessionId, participantId)
      : null

  if (!verified) {
    return (
      <JoinForm qrToken={qrToken} tableLabel={table.label} restaurantName={restaurant.name} />
    )
  }

  const [{ data: categories }, { data: items }, { data: participants }, { data: orderItems }] =
    await Promise.all([
      admin
        .from('menu_categories')
        .select('id, name')
        .eq('restaurant_id', table.restaurant_id)
        .order('sort_order', { ascending: true }),
      admin
        .from('menu_items')
        .select('id, category_id, name, description, price_cents, image_url')
        .eq('restaurant_id', table.restaurant_id)
        .eq('is_available', true)
        .order('sort_order', { ascending: true }),
      admin
        .from('session_participants')
        .select('id, name')
        .eq('table_session_id', verified.session.id)
        .order('created_at', { ascending: true }),
      admin
        .from('order_items')
        .select('id, menu_item_id, participant_id, quantity, order_id')
        .eq('table_session_id', verified.session.id)
        .order('created_at', { ascending: true }),
    ])

  return (
    <LiveTable
      qrToken={qrToken}
      tableLabel={table.label}
      restaurantName={restaurant.name}
      currency={restaurant.currency}
      tableSessionId={verified.session.id}
      participantId={verified.participant.id}
      categories={categories ?? []}
      items={items ?? []}
      initialParticipants={participants ?? []}
      initialOrderItems={orderItems ?? []}
    />
  )
}
