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

export type StaffOrderFormState = { errorCode?: string } | undefined

export async function addStaffItem(
  _prevState: StaffOrderFormState,
  formData: FormData
): Promise<StaffOrderFormState> {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') {
    return { errorCode: 'NO_PERMISSION' }
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
    return { errorCode: 'TABLE_NOT_FOUND' }
  }

  const { data: menuItem } = await admin
    .from('menu_items')
    .select('id, price_cents, available_from, available_until')
    .eq('id', menuItemId)
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .maybeSingle()
  if (!menuItem) {
    return { errorCode: 'ITEM_UNAVAILABLE' }
  }
  if (
    menuItem.available_from &&
    menuItem.available_until &&
    !isWithinTimeWindow(menuItem.available_from, menuItem.available_until, currentTimeInZone())
  ) {
    return { errorCode: 'ITEM_TIME_WINDOW' }
  }

  const sessionId = await getOrCreateOpenSession(admin, table)
  if (!sessionId) {
    return { errorCode: 'COULD_NOT_OPEN_TABLE' }
  }

  const participantId = await getOrCreateStaffParticipant(admin, sessionId)
  if (!participantId) {
    return { errorCode: 'COULD_NOT_REGISTER_ORDER' }
  }

  for (let i = 0; i < quantity; i++) {
    const { error } = await admin.rpc('add_item_to_cart', {
      p_table_session_id: sessionId,
      p_participant_id: participantId,
      p_menu_item_id: menuItemId,
      p_price_cents: menuItem.price_cents,
    })
    if (error) {
      return { errorCode: 'COULD_NOT_ADD_ITEM' }
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
    return { errorCode: 'NO_PERMISSION' }
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
    return { errorCode: 'NO_OPEN_ORDER' }
  }

  const result = await sendSessionOrderToKitchen(admin, session.id, restaurant.id)

  revalidatePath('/admin/floor')
  revalidatePath('/admin/kitchen')

  // sendSessionOrderToKitchen returns a locale-agnostic code, shared with
  // the diner-facing flow — the staff dictionary's error.* namespace
  // carries the same codes (EMPTY_CART, COULD_NOT_SEND_ORDER).
  if (result.errorCode) {
    return { errorCode: result.errorCode }
  }
  return undefined
}
