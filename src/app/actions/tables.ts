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

export async function deleteTable(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase.from('tables').delete().eq('id', id).eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/tables')
}
