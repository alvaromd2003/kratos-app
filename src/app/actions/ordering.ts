'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  dinerCookieName,
  getActiveTableByQrToken,
  getOrCreateOpenSession,
  getVerifiedParticipant,
  sendSessionOrderToKitchen,
} from '@/lib/ordering'
import { isOrderItemClaimed, getOrderItemCoverage } from '@/lib/payments'
import { currentTimeInZone, isWithinTimeWindow } from '@/lib/timezone'

export type OrderingFormState = { error?: string } | undefined

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

  const sessionId = await getOrCreateOpenSession(admin, table)
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
    .select('id, price_cents, available_from, available_until')
    .eq('id', menuItemId)
    .eq('restaurant_id', table.restaurant_id)
    .eq('is_available', true)
    .maybeSingle()
  if (!menuItem) {
    return { error: 'Este plato ya no está disponible.' }
  }
  // The menu shown to diners already hides an out-of-window dish, but a
  // request could still be sent directly bypassing that UI — re-checked
  // here rather than trusted client-side, same as everything else in
  // this file.
  if (
    menuItem.available_from &&
    menuItem.available_until &&
    !isWithinTimeWindow(menuItem.available_from, menuItem.available_until, currentTimeInZone())
  ) {
    return { error: 'Este plato no está disponible a esta hora.' }
  }

  // Adding the same dish again just bumps the quantity on the existing
  // (still unsent) line instead of creating a duplicate row. Done as one
  // atomic upsert (not a separate read-then-write) so two rapid taps, or
  // two diners tapping the same dish at once, can't lose an increment.
  const { error } = await admin.rpc('add_item_to_cart', {
    p_table_session_id: verified.tableSessionId,
    p_participant_id: verified.participantId,
    p_menu_item_id: menuItemId,
    p_price_cents: menuItem.price_cents,
  })

  if (error) {
    return { error: 'No se pudo añadir el plato. Inténtalo de nuevo.' }
  }
}

export async function changeItemQuantity(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemId = String(formData.get('order_item_id') ?? '')
  const delta = Number(formData.get('delta') ?? 0)

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()

  // A line someone already paid for via the itemized payment mode must
  // never shrink or disappear, or that payment ends up covering nothing.
  // Only matters for a decrease — adding more on top of a paid line is
  // harmless (it's just unpaid food stacked on the same row).
  if (delta < 0 && (await isOrderItemClaimed(admin, orderItemId))) {
    return { error: 'Ya se ha pagado (parte de) este plato, así que no se puede reducir.' }
  }

  // A dish added right before its time window closed could otherwise
  // keep growing indefinitely afterward via "+" — addItemToCart already
  // re-checks this for a brand-new line, so an increase on an existing
  // one must too.
  if (delta > 0) {
    const { data: orderItem } = await admin
      .from('order_items')
      .select('menu_item_id')
      .eq('id', orderItemId)
      .eq('table_session_id', verified.tableSessionId)
      .maybeSingle()
    if (orderItem) {
      const { data: menuItem } = await admin
        .from('menu_items')
        .select('available_from, available_until')
        .eq('id', orderItem.menu_item_id)
        .maybeSingle()
      if (
        menuItem?.available_from &&
        menuItem.available_until &&
        !isWithinTimeWindow(menuItem.available_from, menuItem.available_until, currentTimeInZone())
      ) {
        return { error: 'Este plato no está disponible a esta hora.' }
      }
    }
  }

  // Atomic (quantity = quantity + delta, then delete if <=0) instead of a
  // separate read-then-write — otherwise two rapid taps of +/- can read
  // the same starting quantity and one adjustment silently gets lost.
  await admin.rpc('change_cart_item_quantity', {
    p_order_item_id: orderItemId,
    p_table_session_id: verified.tableSessionId,
    p_delta: delta,
  })
}

export async function setItemNote(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemId = String(formData.get('order_item_id') ?? '')
  const note = String(formData.get('note') ?? '').trim().slice(0, 140) || null

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()
  await admin
    .from('order_items')
    .update({ note })
    .eq('id', orderItemId)
    .eq('table_session_id', verified.tableSessionId)
    .is('order_id', null) // can't touch a line that's already with the kitchen
}

export async function removeItemFromCart(
  _prevState: OrderingFormState,
  formData: FormData
): Promise<OrderingFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderItemId = String(formData.get('order_item_id') ?? '')

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()

  // Same reasoning as changeItemQuantity — never let an already-paid
  // line just vanish from the cart with nothing to show for it.
  if (await isOrderItemClaimed(admin, orderItemId)) {
    return { error: 'Ya se ha pagado (parte de) este plato, así que no se puede quitar.' }
  }

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

  const result = await sendSessionOrderToKitchen(admin, verified.tableSessionId, table.restaurant_id)
  if (result.error) {
    return { error: result.error }
  }
}

// A diner can't cancel outright — kitchen might already be on it even
// though the status still says "pending". This just flags the request;
// see confirmCancelOrder / rejectCancelOrder in actions/kitchen.ts.
export async function requestCancelOrder(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const orderId = String(formData.get('order_id') ?? '')

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()
  await admin
    .from('orders')
    .update({ cancellation_requested_at: new Date().toISOString() })
    .eq('id', orderId)
    .eq('table_session_id', verified.tableSessionId)
    .eq('status', 'pending')
}

// Powers the diner-facing page's live view. Deliberately NOT read via the
// browser's own (anon-key) Supabase client anymore — see the migration
// dropping the old "anyone can view an open session" policies for why:
// those policies had no way to check WHICH session the caller belonged to,
// so anyone on the internet could read every restaurant's live orders,
// diner names, and payment amounts. This re-derives and re-verifies the
// caller's own session the same way every diner-facing write already does,
// then reads with the service-role client, so only this table's own data
// is ever returned. Polled on an interval client-side instead of pushed
// via Realtime — a few seconds of lag instead of instant, in exchange for
// closing that leak without a bigger identity-on-the-client overhaul.
export async function getTableSessionSnapshot(qrToken: string) {
  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) return null

  const admin = createAdminClient()

  const [
    { data: orderItems },
    { data: participants },
    { data: orders },
    { data: paymentShares },
    { data: restaurantActiveOrders },
  ] = await Promise.all([
    admin
      .from('order_items')
      .select('id, menu_item_id, participant_id, quantity, order_id, note, price_cents')
      .eq('table_session_id', verified.tableSessionId),
    admin
      .from('session_participants')
      .select('id, name')
      .eq('table_session_id', verified.tableSessionId),
    admin
      .from('orders')
      .select('id, status, created_at, cancellation_requested_at')
      .eq('table_session_id', verified.tableSessionId),
    admin
      .from('payment_shares')
      .select('id, participant_id, mode, amount_cents, status')
      .eq('table_session_id', verified.tableSessionId),
    admin
      .from('orders')
      .select('id, status, created_at')
      .eq('restaurant_id', table.restaurant_id)
      .in('status', ['pending', 'preparing']),
  ])

  const orderItemCoverage = await getOrderItemCoverage(admin, verified.tableSessionId)

  return {
    orderItems: orderItems ?? [],
    participants: participants ?? [],
    orders: orders ?? [],
    paymentShares: paymentShares ?? [],
    restaurantActiveOrders: restaurantActiveOrders ?? [],
    orderItemCoverage: Object.fromEntries(orderItemCoverage),
  }
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
