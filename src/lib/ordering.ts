import 'server-only'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export function dinerCookieName(qrToken: string) {
  return `td_${qrToken}`
}

export async function getActiveTableByQrToken(qrToken: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tables')
    .select('id, restaurant_id, label, active')
    .eq('qr_token', qrToken)
    .eq('active', true)
    .maybeSingle()

  // A real query failure must not look like "this table doesn't exist" —
  // that shows the diner a 404 (as if the QR code itself were broken)
  // instead of a retryable error.
  if (error) {
    throw new Error(`No se pudo comprobar la mesa: ${error.message}`)
  }

  return data
}

// Confirms a (tableSessionId, participantId) pair — as stored in the
// diner's cookie — really belongs to this table and is still open, before
// any read or write trusts it.
export async function getOpenSessionParticipant(
  tableId: string,
  tableSessionId: string,
  participantId: string
) {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('table_sessions')
    .select('id')
    .eq('id', tableSessionId)
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle()
  if (!session) return null

  const { data: participant } = await admin
    .from('session_participants')
    .select('id, name')
    .eq('id', participantId)
    .eq('table_session_id', session.id)
    .maybeSingle()
  if (!participant) return null

  return { session, participant }
}

// The one place every diner-facing write re-derives and re-verifies who's
// asking — never trust the cookie's ids without checking them against the
// DB (see getOpenSessionParticipant above).
export async function getVerifiedParticipant(qrToken: string) {
  const store = await cookies()
  const raw = store.get(dinerCookieName(qrToken))?.value
  if (!raw) return null
  const [participantId, tableSessionId] = raw.split(':')
  if (!participantId || !tableSessionId) return null

  const table = await getActiveTableByQrToken(qrToken)
  if (!table) return null

  const verified = await getOpenSessionParticipant(table.id, tableSessionId, participantId)
  if (!verified) return null

  return { participantId: verified.participant.id, tableSessionId: verified.session.id }
}

// Shared by joinTable (a diner scanning the QR) and the staff-assisted
// order flow (a diner who'd rather not use their own phone) — either way,
// "the" open session for a table, creating it if this is the first
// person at the table this sitting. Handles two people racing to open it
// at the same instant via the unique-open-session-per-table index.
export async function getOrCreateOpenSession(
  admin: ReturnType<typeof createAdminClient>,
  table: { id: string; restaurant_id: string }
): Promise<string | null> {
  const { data: existingSession } = await admin
    .from('table_sessions')
    .select('id')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .maybeSingle()

  if (existingSession) return existingSession.id

  const { data: created, error: createError } = await admin
    .from('table_sessions')
    .insert({ restaurant_id: table.restaurant_id, table_id: table.id })
    .select('id')
    .single()

  if (created) return created.id

  if (createError?.code === '23505') {
    // Someone else opened it a moment before us — use theirs.
    const { data: raceWinner } = await admin
      .from('table_sessions')
      .select('id')
      .eq('table_id', table.id)
      .eq('status', 'open')
      .maybeSingle()
    return raceWinner?.id ?? null
  }

  return null
}

// Shared by sendOrderToKitchen (a diner) and the staff-assisted order
// flow — claims every still-unsent order_item for a session into a new
// orders row, routing straight to 'ready' if the round is drinks-only.
export async function sendSessionOrderToKitchen(
  admin: ReturnType<typeof createAdminClient>,
  tableSessionId: string,
  restaurantId: string
): Promise<{ error?: string }> {
  const { data: pendingItems } = await admin
    .from('order_items')
    .select('id, menu_item_id')
    .eq('table_session_id', tableSessionId)
    .is('order_id', null)

  if (!pendingItems || pendingItems.length === 0) {
    return { error: 'No hay nada en el carrito para enviar.' }
  }

  const menuItemIds = [...new Set(pendingItems.map((i) => i.menu_item_id))]
  const { data: menuItems } = await admin
    .from('menu_items')
    .select('id, category_id')
    .in('id', menuItemIds)
  const categoryIds = [
    ...new Set((menuItems ?? []).map((m) => m.category_id).filter((id): id is string => !!id)),
  ]
  const { data: categories } =
    categoryIds.length > 0
      ? await admin.from('menu_categories').select('id, station').in('id', categoryIds)
      : { data: [] }
  const stationByCategoryId = new Map((categories ?? []).map((c) => [c.id, c.station]))
  const categoryByMenuItemId = new Map((menuItems ?? []).map((m) => [m.id, m.category_id]))
  const hasKitchenItem = pendingItems.some((item) => {
    const categoryId = categoryByMenuItemId.get(item.menu_item_id)
    const station = categoryId ? (stationByCategoryId.get(categoryId) ?? 'kitchen') : 'kitchen'
    return station === 'kitchen'
  })

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      restaurant_id: restaurantId,
      table_session_id: tableSessionId,
      status: hasKitchenItem ? 'pending' : 'ready',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    return { error: 'No se pudo enviar el pedido. Inténtalo de nuevo.' }
  }

  // Scoped to exactly the ids read above — NOT "whatever is still
  // unclaimed right now". A dish added between that read and this write
  // (another diner tapping "+" a moment later, very plausible with
  // several phones at once) must start its own next round, never get
  // swept into an order whose kitchen/ready routing was already decided
  // without it — a drinks-only order already committed as 'ready' could
  // otherwise silently absorb a kitchen dish and skip the kitchen board
  // entirely. .is('order_id', null) still guards the same double-send
  // race as before: if a concurrent send already claimed these same ids,
  // this update matches nothing and the order below gets cleaned up.
  const { data: claimed, error: updateError } = await admin
    .from('order_items')
    .update({ order_id: order.id })
    .in(
      'id',
      pendingItems.map((item) => item.id)
    )
    .is('order_id', null)
    .select('id')

  if (updateError) {
    await admin.from('orders').delete().eq('id', order.id)
    return { error: 'No se pudo enviar el pedido. Inténtalo de nuevo.' }
  }

  if (!claimed || claimed.length === 0) {
    await admin.from('orders').delete().eq('id', order.id)
  }

  return {}
}

// Quiet fallback for a diner who can't or won't use their own phone — not
// something to lead with in a sales pitch (the whole point of Kratos is
// not needing a waiter to take orders), just a safety net so that diner
// isn't left out and their order still ends up properly recorded instead
// of handled entirely off-system. Also doubles as the attribution for a
// staff-recorded manual payment (cash/datáfono collected in person) when
// nobody at a table ever scanned the QR, so there's no real participant to
// credit it to.
export const STAFF_PARTICIPANT_NAME = 'Pedido en barra'

export async function getOrCreateStaffParticipant(
  admin: ReturnType<typeof createAdminClient>,
  tableSessionId: string
): Promise<string | null> {
  const { data: existing } = await admin
    .from('session_participants')
    .select('id')
    .eq('table_session_id', tableSessionId)
    .eq('name', STAFF_PARTICIPANT_NAME)
    .maybeSingle()
  if (existing) return existing.id

  const { data: created } = await admin
    .from('session_participants')
    .insert({ table_session_id: tableSessionId, name: STAFF_PARTICIPANT_NAME })
    .select('id')
    .single()
  return created?.id ?? null
}
