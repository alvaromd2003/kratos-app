'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getOpenSessionParticipant } from '@/lib/ordering'

export type OrderingFormState = { error?: string } | undefined

function dinerCookieName(qrToken: string) {
  return `td_${qrToken}`
}

async function getVerifiedParticipant(qrToken: string) {
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

export async function joinTable(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Escribe tu nombre.' }
  }
  if (name.length > 40) {
    return { error: 'El nombre es demasiado largo.' }
  }

  const table = await getActiveTableByQrToken(qrToken)
  if (!table) {
    return { error: 'Esta mesa ya no está disponible.' }
  }

  const admin = createAdminClient()

  const { data: existingSession } = await admin
    .from('table_sessions')
    .select('id')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .maybeSingle()

  let sessionId = existingSession?.id

  if (!sessionId) {
    const { data: created, error: createError } = await admin
      .from('table_sessions')
      .insert({ restaurant_id: table.restaurant_id, table_id: table.id })
      .select('id')
      .single()

    if (created) {
      sessionId = created.id
    } else if (createError?.code === '23505') {
      // Someone else opened the session a moment before us — use theirs.
      const { data: raceWinner } = await admin
        .from('table_sessions')
        .select('id')
        .eq('table_id', table.id)
        .eq('status', 'open')
        .maybeSingle()
      sessionId = raceWinner?.id
    }
  }

  if (!sessionId) {
    return { error: 'No se pudo abrir la mesa. Inténtalo de nuevo.' }
  }

  const { data: participant, error: participantError } = await admin
    .from('session_participants')
    .insert({ table_session_id: sessionId, name })
    .select('id')
    .single()

  if (participantError || !participant) {
    return { error: 'No se pudo unir a la mesa. Inténtalo de nuevo.' }
  }

  const store = await cookies()
  store.set(dinerCookieName(qrToken), `${participant.id}:${sessionId}`, {
    httpOnly: true,
    sameSite: 'lax',
    path: `/t/${qrToken}`,
    maxAge: 60 * 60 * 12, // 12h — long enough for a full sitting at the table.
  })

  redirect(`/t/${qrToken}`)
}

export async function addItemToCart(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const menuItemId = String(formData.get('menu_item_id') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
  }

  const admin = createAdminClient()

  // The dish must actually belong to this restaurant's menu — a diner
  // could otherwise pass any menu_item_id and add another restaurant's
  // dish to the cart.
  const { data: menuItem } = await admin
    .from('menu_items')
    .select('id')
    .eq('id', menuItemId)
    .eq('restaurant_id', table.restaurant_id)
    .eq('is_available', true)
    .maybeSingle()
  if (!menuItem) {
    return { error: 'Este plato ya no está disponible.' }
  }

  // Adding the same dish again just bumps the quantity on the existing
  // (still unsent) line instead of creating a duplicate row.
  const { data: existing } = await admin
    .from('order_items')
    .select('id, quantity')
    .eq('table_session_id', verified.tableSessionId)
    .eq('participant_id', verified.participantId)
    .eq('menu_item_id', menuItemId)
    .is('order_id', null)
    .maybeSingle()

  const { error } = existing
    ? await admin
        .from('order_items')
        .update({ quantity: existing.quantity + 1 })
        .eq('id', existing.id)
    : await admin.from('order_items').insert({
        table_session_id: verified.tableSessionId,
        menu_item_id: menuItemId,
        participant_id: verified.participantId,
        quantity: 1,
      })

  if (error) {
    return { error: 'No se pudo añadir el plato. Inténtalo de nuevo.' }
  }
}

export async function changeItemQuantity(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemId = String(formData.get('order_item_id') ?? '')
  const delta = Number(formData.get('delta') ?? 0)

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()
  const { data: row } = await admin
    .from('order_items')
    .select('quantity')
    .eq('id', orderItemId)
    .eq('table_session_id', verified.tableSessionId)
    .is('order_id', null) // can't touch a line that's already with the kitchen
    .maybeSingle()
  if (!row) return

  const nextQuantity = row.quantity + delta
  if (nextQuantity <= 0) {
    await admin
      .from('order_items')
      .delete()
      .eq('id', orderItemId)
      .eq('table_session_id', verified.tableSessionId)
    return
  }

  await admin
    .from('order_items')
    .update({ quantity: nextQuantity })
    .eq('id', orderItemId)
    .eq('table_session_id', verified.tableSessionId)
}

export async function removeItemFromCart(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemId = String(formData.get('order_item_id') ?? '')

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()
  await admin
    .from('order_items')
    .delete()
    .eq('id', orderItemId)
    .eq('table_session_id', verified.tableSessionId)
    .is('order_id', null)
}

export async function sendOrderToKitchen(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
  }

  const admin = createAdminClient()

  const { data: pendingItems } = await admin
    .from('order_items')
    .select('id, menu_item_id')
    .eq('table_session_id', verified.tableSessionId)
    .is('order_id', null)

  if (!pendingItems || pendingItems.length === 0) {
    return { error: 'Añade algo al carrito antes de enviar el pedido.' }
  }

  // A round that's drinks-only has nothing for the kitchen to do — it
  // skips straight to "ready", so it lands directly on Barra's board
  // instead of sitting on Cocina's until someone notices there's no food
  // in it.
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
      restaurant_id: table.restaurant_id,
      table_session_id: verified.tableSessionId,
      status: hasKitchenItem ? 'pending' : 'ready',
    })
    .select('id')
    .single()

  if (orderError || !order) {
    return { error: 'No se pudo enviar el pedido. Inténtalo de nuevo.' }
  }

  const { error: updateError } = await admin
    .from('order_items')
    .update({ order_id: order.id })
    .eq('table_session_id', verified.tableSessionId)
    .is('order_id', null)

  if (updateError) {
    return { error: 'No se pudo enviar el pedido. Inténtalo de nuevo.' }
  }
}

// Only while the order is still "pending" (kitchen hasn't started it) —
// puts the items back in the open cart rather than just discarding them.
export async function cancelOrder(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderId = String(formData.get('order_id') ?? '')

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', orderId)
    .eq('table_session_id', verified.tableSessionId)
    .maybeSingle()
  if (!order || order.status !== 'pending') return

  await admin.from('order_items').update({ order_id: null }).eq('order_id', orderId)
  await admin.from('orders').delete().eq('id', orderId)
}

export async function requestHelp(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
  }

  const admin = createAdminClient()

  // Don't stack duplicate alerts if someone taps the button twice.
  const { data: existing } = await admin
    .from('help_requests')
    .select('id')
    .eq('table_session_id', verified.tableSessionId)
    .eq('status', 'open')
    .maybeSingle()
  if (existing) return

  const { error } = await admin.from('help_requests').insert({
    restaurant_id: table.restaurant_id,
    table_session_id: verified.tableSessionId,
  })

  if (error) {
    return { error: 'No se pudo avisar. Inténtalo de nuevo.' }
  }
}
