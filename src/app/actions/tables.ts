'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'

export type TableFormState = { error?: string } | undefined

export async function createTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const label = String(formData.get('label') ?? '').trim()

  if (!label) {
    return { error: 'Escribe un nombre o número de mesa.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tables')
    .insert({ restaurant_id: restaurant.id, label })

  if (error) {
    return { error: 'No se pudo crear la mesa.' }
  }

  revalidatePath('/admin/tables')
}

export async function updateTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim()

  if (!label) {
    return { error: 'Escribe un nombre o número de mesa.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tables')
    .update({ label })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { error: 'No se pudo actualizar la mesa.' }
  }

  revalidatePath('/admin/tables')
}

export async function deleteTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()

  // Deleting cascades to every session/order this table ever had (that's
  // how the schema is set up) — block it once there's real history so a
  // rename-by-delete-and-recreate doesn't silently wipe the record.
  const { count } = await supabase
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', id)
    .eq('restaurant_id', restaurant.id)

  if ((count ?? 0) > 0) {
    return {
      error:
        'Esta mesa ya tiene pedidos en su historial, así que no se puede eliminar del todo. Usa "Desactivar" para quitarla de servicio sin perder ese historial.',
    }
  }

  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { error: 'No se pudo eliminar la mesa.' }
  }

  revalidatePath('/admin/tables')
}

export async function toggleTableActive(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const wasActive = formData.get('active') === 'true'

  const supabase = await createClient()
  await supabase
    .from('tables')
    .update({ active: !wasActive })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/tables')
}

// Ends the group currently seated at this table so the next QR scan starts
// a brand-new session instead of joining the outgoing group's. Any staff
// member can do this — in practice it's the floor/kitchen staff who know
// when a group has actually left, not just the owner.
export async function closeTableSession(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const tableId = String(formData.get('table_id') ?? '')

  const supabase = await createClient()

  const { data: table } = await supabase
    .from('tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!table) return

  await supabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('table_id', table.id)
    .eq('status', 'open')

  revalidatePath('/admin/tables')
  revalidatePath('/admin/kitchen')
}
