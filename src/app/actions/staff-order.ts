'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { getOrCreateOpenSession, sendSessionOrderToKitchen } from '@/lib/ordering'

export type StaffOrderFormState = { error?: string } | undefined

// Quiet fallback for a diner who can't or won't use their own phone — not
// something to lead with in a sales pitch (the whole point of Kratos is
// not needing a waiter to take orders), just a safety net so that diner
// isn't left out and their order still ends up properly recorded instead
// of handled entirely off-system.
const STAFF_PARTICIPANT_NAME = 'Pedido en barra'
type AdminClient = ReturnType<typeof createAdminClient>

async function getOrCreateStaffParticipant(
  admin: AdminClient,
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
    .select('id')
    .eq('id', menuItemId)
    .eq('restaurant_id', restaurant.id)
    .eq('is_available', true)
    .maybeSingle()
  if (!menuItem) {
    return { error: 'Este plato ya no está disponible.' }
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
