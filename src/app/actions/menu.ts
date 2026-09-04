'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { DIETARY_TAGS } from '@/lib/dietary-tags'

const VALID_DIETARY_TAGS = new Set<string>(DIETARY_TAGS.map((t) => t.value))

function readDietaryTags(formData: FormData): string[] {
  return formData
    .getAll('dietary_tags')
    .filter((tag): tag is string => typeof tag === 'string' && VALID_DIETARY_TAGS.has(tag))
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export type MenuFormState = { error?: string } | undefined

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

async function getNextSortOrder(
  supabase: SupabaseServerClient,
  table: 'menu_categories' | 'menu_items',
  restaurantId: string
) {
  const { data } = await supabase
    .from(table)
    .select('sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (data?.sort_order ?? -1) + 1
}

function extractStoragePath(publicUrl: string): string | null {
  const marker = '/menu-images/'
  const index = publicUrl.indexOf(marker)
  if (index === -1) return null
  return publicUrl.slice(index + marker.length)
}

async function reorder(
  supabase: SupabaseServerClient,
  table: 'menu_categories' | 'menu_items',
  restaurantId: string,
  id: string,
  direction: 'up' | 'down'
) {
  const { data: rows } = await supabase
    .from(table)
    .select('id, sort_order')
    .eq('restaurant_id', restaurantId)
    .order('sort_order', { ascending: true })

  if (!rows) return

  const index = rows.findIndex((row) => row.id === id)
  const swapIndex = direction === 'up' ? index - 1 : index + 1
  if (index === -1 || swapIndex < 0 || swapIndex >= rows.length) return

  const current = rows[index]
  const swap = rows[swapIndex]

  await supabase.from(table).update({ sort_order: swap.sort_order }).eq('id', current.id)
  await supabase.from(table).update({ sort_order: current.sort_order }).eq('id', swap.id)
}

export async function createCategory(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const name = String(formData.get('name') ?? '').trim()
  const station = formData.get('station') === 'bar' ? 'bar' : 'kitchen'
  if (!name) {
    return { error: 'Escribe un nombre de categoría.' }
  }

  const supabase = await createClient()
  const sortOrder = await getNextSortOrder(supabase, 'menu_categories', restaurant.id)
  const { error } = await supabase
    .from('menu_categories')
    .insert({ restaurant_id: restaurant.id, name, sort_order: sortOrder, station })

  if (error) {
    return { error: 'No se pudo crear la categoría.' }
  }

  revalidatePath('/admin/menu')
}

export async function updateCategory(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const station = formData.get('station') === 'bar' ? 'bar' : 'kitchen'

  if (!name) {
    return { error: 'Escribe un nombre de categoría.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('menu_categories')
    .update({ name, station })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { error: 'No se pudo actualizar la categoría.' }
  }

  revalidatePath('/admin/menu')
}

export async function moveCategory(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const direction = String(formData.get('direction') ?? '') as 'up' | 'down'

  const supabase = await createClient()
  await reorder(supabase, 'menu_categories', restaurant.id, id, direction)

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
  const imageFile = formData.get('image')
  const dietaryTags = readDietaryTags(formData)

  if (!name) {
    return { error: 'Escribe un nombre de plato.' }
  }

  const priceNumber = Number(priceRaw.replace(',', '.'))
  if (!priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
    return { error: 'Introduce un precio válido, por ejemplo 9.50.' }
  }
  const priceCents = Math.round(priceNumber * 100)

  const supabase = await createClient()

  let imageUrl: string | null = null
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: 'La foto pesa demasiado (máximo 5MB).' }
    }
    if (!imageFile.type.startsWith('image/')) {
      return { error: 'El archivo tiene que ser una imagen.' }
    }

    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${restaurant.id}/${randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(path, imageFile, { contentType: imageFile.type })

    if (uploadError) {
      return { error: 'No se pudo subir la foto. Inténtalo de nuevo.' }
    }

    imageUrl = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
  }

  const sortOrder = await getNextSortOrder(supabase, 'menu_items', restaurant.id)
  const { error } = await supabase.from('menu_items').insert({
    restaurant_id: restaurant.id,
    category_id: categoryId,
    name,
    description,
    price_cents: priceCents,
    image_url: imageUrl,
    sort_order: sortOrder,
    dietary_tags: dietaryTags,
  })

  if (error) {
    return { error: 'No se pudo crear el plato.' }
  }

  revalidatePath('/admin/menu')
}

export async function updateMenuItem(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const priceRaw = String(formData.get('price') ?? '').trim()
  const categoryId = String(formData.get('category_id') ?? '') || null
  const description = String(formData.get('description') ?? '').trim() || null
  const imageFile = formData.get('image')
  const dietaryTags = readDietaryTags(formData)

  if (!id) {
    return { error: 'Falta el identificador del plato.' }
  }
  if (!name) {
    return { error: 'Escribe un nombre de plato.' }
  }

  const priceNumber = Number(priceRaw.replace(',', '.'))
  if (!priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
    return { error: 'Introduce un precio válido, por ejemplo 9.50.' }
  }
  const priceCents = Math.round(priceNumber * 100)

  const supabase = await createClient()

  const updates: {
    name: string
    description: string | null
    price_cents: number
    category_id: string | null
    dietary_tags: string[]
    image_url?: string
  } = {
    name,
    description,
    price_cents: priceCents,
    category_id: categoryId,
    dietary_tags: dietaryTags,
  }

  let oldImagePath: string | null = null

  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { error: 'La foto pesa demasiado (máximo 5MB).' }
    }
    if (!imageFile.type.startsWith('image/')) {
      return { error: 'El archivo tiene que ser una imagen.' }
    }

    const { data: existing } = await supabase
      .from('menu_items')
      .select('image_url')
      .eq('id', id)
      .eq('restaurant_id', restaurant.id)
      .maybeSingle()
    if (existing?.image_url) {
      oldImagePath = extractStoragePath(existing.image_url)
    }

    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${restaurant.id}/${randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(path, imageFile, { contentType: imageFile.type })

    if (uploadError) {
      return { error: 'No se pudo subir la foto. Inténtalo de nuevo.' }
    }

    updates.image_url = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { error: 'No se pudo actualizar el plato.' }
  }

  if (oldImagePath) {
    await supabase.storage.from('menu-images').remove([oldImagePath])
  }

  revalidatePath('/admin/menu')
}

export async function moveMenuItem(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const direction = String(formData.get('direction') ?? '') as 'up' | 'down'

  const supabase = await createClient()
  await reorder(supabase, 'menu_items', restaurant.id, id, direction)

  revalidatePath('/admin/menu')
}

export async function deleteMenuItem(
  _prevState: MenuFormState,
  formData: FormData
): Promise<MenuFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('menu_items')
    .select('image_url')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()

  const { error } = await supabase
    .from('menu_items')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    if (error.code === '23503') {
      return {
        error:
          'Este plato ya tiene pedidos registrados, así que no se puede eliminar del todo. Usa "Ocultar" para quitarlo del menú sin perder ese historial.',
      }
    }
    return { error: 'No se pudo eliminar el plato.' }
  }

  if (existing?.image_url) {
    const path = extractStoragePath(existing.image_url)
    if (path) {
      await supabase.storage.from('menu-images').remove([path])
    }
  }

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
