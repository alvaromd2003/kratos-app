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
  // line instead of creating a duplicate row.
  const { data: existing } = await admin
    .from('order_items')
    .select('id, quantity')
    .eq('table_session_id', verified.tableSessionId)
    .eq('participant_id', verified.participantId)
    .eq('menu_item_id', menuItemId)
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
}
