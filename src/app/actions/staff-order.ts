'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'
import {
  getOrCreateOpenSession,
  getOrCreateStaffParticipant,
  sendSessionOrderToKitchen,
} from '@/lib/ordering'
import { currentTimeInZone, isWithinTimeWindow } from '@/lib/timezone'

export type StaffOrderFormState = { error?: string } | undefined

export async function addStaffItem(
  _prevState: StaffOrderFormState,
  formData: FormData
): Promise<StaffOrderFormState> {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') {
    return { error: 'No tienes permiso.' }
  }

  const tableId = String(formData.get('table_id') ?? '')
  const menuItemId = String(formData.get('menu_item_id') ?? '')
  const quantity = Math.max(1, Math.min(20, Math.floor(Number(formData.get('quantity') ?? 1))))
  const note = String(formData.get('note') ?? '').trim().slice(0, 140) || null

  const admin = createAdminClient()

  const { data: table } = await admin
    .from('tables')
    .select('id, restaurant_id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!table) {
    return { error: 'Mesa no encontrada.' }
  }

  const { data: menuItem } = await admin
    .from('menu_items')
    .select('id, available_from, available_until')
    .eq('id', menuItemId)
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .maybeSingle()
  if (!menuItem) {
    return { error: 'Este plato ya no está disponible.' }
  }
  if (
    menuItem.available_from &&
    menuItem.available_until &&
    !isWithinTimeWindow(menuItem.available_from, menuItem.available_until, currentTimeInZone())
  ) {
    return { error: 'Este plato no está disponible a esta hora.' }
  }

  const sessionId = await getOrCreateOpenSession(admin, table)
  if (!sessionId) {
    return { error: 'No se pudo abrir la mesa. Inténtalo de nuevo.' }
  }

  const participantId = await getOrCreateStaffParticipant(admin, sessionId)
  if (!participantId) {
    return { error: 'No se pudo registrar el pedido. Inténtalo de nuevo.' }
  }

  for (let i = 0; i < quantity; i++) {
    const { error } = await admin.rpc('add_item_to_cart', {
      p_table_session_id: sessionId,
      p_participant_id: participantId,
      p_menu_item_id: menuItemId,
    })
    if (error) {
      return { error: 'No se pudo añadir el plato. Inténtalo de nuevo.' }
    }
  }

  // add_item_to_cart upserts onto one shared (session, participant, dish)
  // line, so after the loop above there's exactly one row to attach the
  // note to — same semantics as the diner-facing setItemNote (overwrites
  // whatever note that line already had).
  if (note) {
    await admin
      .from('order_items')
      .update({ note })
      .eq('table_session_id', sessionId)
      .eq('participant_id', participantId)
      .eq('menu_item_id', menuItemId)
      .is('order_id', null)
  }

  revalidatePath('/admin/floor')
}

export async function sendStaffOrder(
  _prevState: StaffOrderFormState,
  formData: FormData
): Promise<StaffOrderFormState> {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') {
    return { error: 'No tienes permiso.' }
  }

  const tableId = String(formData.get('table_id') ?? '')
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('table_sessions')
    .select('id')
    .eq('table_id', tableId)
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'open')
    .maybeSingle()
  if (!session) {
    return { error: 'Esta mesa no tiene ningún pedido abierto.' }
  }

  const result = await sendSessionOrderToKitchen(admin, session.id, restaurant.id)

  revalidatePath('/admin/floor')
  revalidatePath('/admin/kitchen')

  return result.error ? { error: result.error } : undefined
}
