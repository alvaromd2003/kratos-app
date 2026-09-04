'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'

export type MenuFormState = { error?: string } | undefined

export async function createCategory(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Escribe un nombre de categoría.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('menu_categories')
    .insert({ restaurant_id: restaurant.id, name })

  if (error) {
    return { error: 'No se pudo crear la categoría.' }
  }

  revalidatePath('/admin/menu')
}

export async function deleteCategory(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase
    .from('menu_categories')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/menu')
}

export async function createMenuItem(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()

  const name = String(formData.get('name') ?? '').trim()
  const priceRaw = String(formData.get('price') ?? '').trim()
  const categoryId = String(formData.get('category_id') ?? '') || null
  const description = String(formData.get('description') ?? '').trim() || null
  const imageUrl = String(formData.get('image_url') ?? '').trim() || null

  if (!name) {
    return { error: 'Escribe un nombre de plato.' }
  }

  const priceNumber = Number(priceRaw.replace(',', '.'))
  if (!priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
    return { error: 'Introduce un precio válido, por ejemplo 9.50.' }
  }
  const priceCents = Math.round(priceNumber * 100)

  const supabase = await createClient()
  const { error } = await supabase.from('menu_items').insert({
    restaurant_id: restaurant.id,
    category_id: categoryId,
    name,
    description,
    price_cents: priceCents,
    image_url: imageUrl,
  })

  if (error) {
    return { error: 'No se pudo crear el plato.' }
  }

  revalidatePath('/admin/menu')
}

export async function deleteMenuItem(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase
    .from('menu_items')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/menu')
}

export async function toggleMenuItemAvailability(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const wasAvailable = formData.get('is_available') === 'true'

  const supabase = await createClient()
  await supabase
    .from('menu_items')
    .update({ is_available: !wasAvailable })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/menu')
}
