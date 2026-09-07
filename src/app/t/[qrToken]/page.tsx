import { cookies } from 'next/headers'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getOpenSessionParticipant } from '@/lib/ordering'
import { getAverageWaitMinutes } from '@/lib/orders'
import { getClaimedOrderItemIds } from '@/lib/payments'
import { currentTimeInZone, isWithinTimeWindow } from '@/lib/timezone'
import { JoinForm } from './join-form'
import { LiveTable } from './live-table'
import { MenuPreview } from './menu-preview'

export default async function TableOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ qrToken: string }>
  searchParams: Promise<{ payment?: string; browse?: string }>
}) {
  const { qrToken } = await params
  const { payment, browse } = await searchParams
  const paymentResult = payment === 'success' || payment === 'cancelled' ? payment : null

  const table = await getActiveTableByQrToken(qrToken)
  if (!table) {
    notFound()
  }

  const admin = createAdminClient()
  const { data: restaurant, error: restaurantError } = await admin
    .from('restaurants')
    .select('name, currency, enabled_dietary_tags, stripe_onboarding_complete, google_review_url')
    .eq('id', table.restaurant_id)
    .single()

  // Same reasoning as getActiveTableByQrToken: a real query failure must
  // not show the diner a 404 as if the restaurant didn't exist.
  if (restaurantError) {
    throw new Error(`No se pudo cargar el restaurante: ${restaurantError.message}`)
  }
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
    if (browse === '1') {
      const [{ data: previewCategories }, { data: previewItems }] = await Promise.all([
        admin
          .from('menu_categories')
          .select('id, name')
          .eq('restaurant_id', table.restaurant_id)
          .order('sort_order', { ascending: true }),
        admin
          .from('menu_items')
          .select('id, category_id, name, description, price_cents, image_url, dietary_tags, available_from, available_until')
          .eq('restaurant_id', table.restaurant_id)
          .eq('is_available', true)
          .order('sort_order', { ascending: true }),
      ])
      const now = currentTimeInZone()
      const visiblePreviewItems = (previewItems ?? []).filter(
        (item) =>
          !item.available_from ||
          !item.available_until ||
          isWithinTimeWindow(item.available_from, item.available_until, now)
      )
      return (
        <MenuPreview
          qrToken={qrToken}
          tableLabel={table.label}
          restaurantName={restaurant.name}
          currency={restaurant.currency}
          enabledTags={restaurant.enabled_dietary_tags}
          categories={previewCategories ?? []}
          items={visiblePreviewItems}
        />
      )
    }
    return (
      <JoinForm qrToken={qrToken} tableLabel={table.label} restaurantName={restaurant.name} />
    )
  }

  const [
    { data: categories },
    { data: items },
    { data: participants },
    { data: orderItems },
    { data: orders },
    { data: paymentShares },
  ] = await Promise.all([
    admin
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', table.restaurant_id)
      .order('sort_order', { ascending: true }),
    admin
      .from('menu_items')
      .select(
        'id, category_id, name, description, price_cents, image_url, dietary_tags, recommended_item_id, available_from, available_until'
      )
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
      .select('id, menu_item_id, participant_id, quantity, order_id, note')
      .eq('table_session_id', verified.session.id)
      .order('created_at', { ascending: true }),
    admin
      .from('orders')
      .select('id, status, created_at, cancellation_requested_at')
      .eq('table_session_id', verified.session.id)
      .order('created_at', { ascending: true }),
    admin
      .from('payment_shares')
      .select('id, participant_id, mode, amount_cents, status')
      .eq('table_session_id', verified.session.id),
  ])

  // Time-windowed dishes (e.g. breakfast-only) — only filtered on this
  // diner-facing fetch, never on the owner's /admin/menu list.
  const now = currentTimeInZone()
  const visibleItems = (items ?? []).filter(
    (item) =>
      !item.available_from ||
      !item.available_until ||
      isWithinTimeWindow(item.available_from, item.available_until, now)
  )

  // For "hay N pedidos por delante" — every other order this restaurant
  // still has in the kitchen queue right now, regardless of table.
  const { data: restaurantActiveOrders } = await admin
    .from('orders')
    .select('id, status, created_at')
    .eq('restaurant_id', table.restaurant_id)
    .in('status', ['pending', 'preparing'])

  const avgWaitMinutes = await getAverageWaitMinutes(admin, table.restaurant_id)
  const claimedOrderItemIds = await getClaimedOrderItemIds(admin, verified.session.id)

  // Fetched separately from the shared `participants` list above (which
  // only exposes id/name to every diner at the table) — an email and a
  // private rating are only ever shown to whoever left them, never to
  // the other diners at the table.
  const { data: ownParticipant } = await admin
    .from('session_participants')
    .select('loyalty_email, feedback_rating')
    .eq('id', verified.participant.id)
    .maybeSingle()

  const loyaltyEmail = ownParticipant?.loyalty_email ?? null
  const hasSubmittedFeedback = ownParticipant?.feedback_rating != null
  let loyaltyStamps = 0
  if (loyaltyEmail) {
    const { data: loyaltyAccount } = await admin
      .from('loyalty_accounts')
      .select('stamps')
      .eq('restaurant_id', table.restaurant_id)
      .eq('email', loyaltyEmail)
      .maybeSingle()
    loyaltyStamps = loyaltyAccount?.stamps ?? 0
  }

  return (
    <LiveTable
      qrToken={qrToken}
      tableLabel={table.label}
      restaurantName={restaurant.name}
      currency={restaurant.currency}
      enabledTags={restaurant.enabled_dietary_tags}
      restaurantId={table.restaurant_id}
      tableSessionId={verified.session.id}
      participantId={verified.participant.id}
      categories={categories ?? []}
      items={visibleItems}
      initialParticipants={participants ?? []}
      initialOrderItems={orderItems ?? []}
      initialOrders={orders ?? []}
      initialRestaurantActiveOrders={restaurantActiveOrders ?? []}
      stripeOnboardingComplete={restaurant.stripe_onboarding_complete}
      initialPaymentShares={paymentShares ?? []}
      paymentResult={paymentResult}
      avgWaitMinutes={avgWaitMinutes}
      loyaltyEmail={loyaltyEmail}
      loyaltyStamps={loyaltyStamps}
      googleReviewUrl={restaurant.google_review_url}
      hasSubmittedFeedback={hasSubmittedFeedback}
      claimedOrderItemIds={[...claimedOrderItemIds]}
    />
  )
}
