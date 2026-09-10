'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { parseCsv } from '@/lib/csv'

const VALID_DIETARY_TAGS = new Set<string>(DIETARY_TAGS.map((t) => t.value))

function readDietaryTags(formData: FormData): string[] {
  return formData
    .getAll('dietary_tags')
    .filter((tag): tag is string => typeof tag === 'string' && VALID_DIETARY_TAGS.has(tag))
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5 MB

export type MenuFormState = { errorCode?: string } | undefined

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
    return { errorCode: 'EMPTY_CATEGORY_NAME' }
  }

  const supabase = await createClient()
  const sortOrder = await getNextSortOrder(supabase, 'menu_categories', restaurant.id)
  const { error } = await supabase
    .from('menu_categories')
    .insert({ restaurant_id: restaurant.id, name, sort_order: sortOrder, station })

  if (error) {
    return { errorCode: 'COULD_NOT_CREATE_CATEGORY' }
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
    return { errorCode: 'EMPTY_CATEGORY_NAME' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('menu_categories')
    .update({ name, station })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { errorCode: 'COULD_NOT_UPDATE_CATEGORY' }
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
  const recommendedItemId = String(formData.get('recommended_item_id') ?? '') || null
  const availableFrom = String(formData.get('available_from') ?? '') || null
  const availableUntil = String(formData.get('available_until') ?? '') || null

  if (!name) {
    return { errorCode: 'EMPTY_ITEM_NAME' }
  }

  const priceNumber = Number(priceRaw.replace(',', '.'))
  if (!priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
    return { errorCode: 'INVALID_PRICE' }
  }
  const priceCents = Math.round(priceNumber * 100)

  const supabase = await createClient()

  let imageUrl: string | null = null
  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { errorCode: 'IMAGE_TOO_LARGE' }
    }
    if (!imageFile.type.startsWith('image/')) {
      return { errorCode: 'FILE_MUST_BE_IMAGE' }
    }

    const extension = imageFile.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${restaurant.id}/${randomUUID()}.${extension}`

    const { error: uploadError } = await supabase.storage
      .from('menu-images')
      .upload(path, imageFile, { contentType: imageFile.type })

    if (uploadError) {
      return { errorCode: 'COULD_NOT_UPLOAD_IMAGE' }
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
    recommended_item_id: recommendedItemId,
    available_from: availableFrom,
    available_until: availableUntil,
  })

  if (error) {
    return { errorCode: 'COULD_NOT_CREATE_ITEM' }
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
  const recommendedItemIdRaw = String(formData.get('recommended_item_id') ?? '') || null
  const recommendedItemId = recommendedItemIdRaw === id ? null : recommendedItemIdRaw
  const availableFrom = String(formData.get('available_from') ?? '') || null
  const availableUntil = String(formData.get('available_until') ?? '') || null

  if (!id) {
    return { errorCode: 'MISSING_ITEM_ID' }
  }
  if (!name) {
    return { errorCode: 'EMPTY_ITEM_NAME' }
  }

  const priceNumber = Number(priceRaw.replace(',', '.'))
  if (!priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
    return { errorCode: 'INVALID_PRICE' }
  }
  const priceCents = Math.round(priceNumber * 100)

  const supabase = await createClient()

  const updates: {
    name: string
    description: string | null
    price_cents: number
    category_id: string | null
    dietary_tags: string[]
    recommended_item_id: string | null
    available_from: string | null
    available_until: string | null
    image_url?: string
  } = {
    name,
    description,
    price_cents: priceCents,
    category_id: categoryId,
    dietary_tags: dietaryTags,
    recommended_item_id: recommendedItemId,
    available_from: availableFrom,
    available_until: availableUntil,
  }

  let oldImagePath: string | null = null

  if (imageFile instanceof File && imageFile.size > 0) {
    if (imageFile.size > MAX_IMAGE_BYTES) {
      return { errorCode: 'IMAGE_TOO_LARGE' }
    }
    if (!imageFile.type.startsWith('image/')) {
      return { errorCode: 'FILE_MUST_BE_IMAGE' }
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
      return { errorCode: 'COULD_NOT_UPLOAD_IMAGE' }
    }

    updates.image_url = supabase.storage.from('menu-images').getPublicUrl(path).data.publicUrl
  }

  const { error } = await supabase
    .from('menu_items')
    .update(updates)
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { errorCode: 'COULD_NOT_UPDATE_ITEM' }
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
      return { errorCode: 'ITEM_HAS_ORDERS' }
    }
    return { errorCode: 'COULD_NOT_DELETE_ITEM' }
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

  const supabase = await createClient()

  // Reads the current value itself instead of trusting a hidden input
  // (which can be stale if another staff member already toggled it from
  // a different device) — otherwise this can flip it right back.
  const { data: current } = await supabase
    .from('menu_items')
    .select('is_available')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!current) return

  await supabase
    .from('menu_items')
    .update({ is_available: !current.is_available })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/menu')
}

export type BulkImportState = { errorCode?: string; created?: number; skipped?: number } | undefined

// Accent-insensitive so "Descripción" in the header row (likely, since
// most owners will type it with the accent) still matches "descripcion".
function normalizeHeader(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase()
}

const TIME_PATTERN = /^\d{1,2}:\d{2}$/

const MAX_CSV_BYTES = 2 * 1024 * 1024 // 2 MB — generous for a menu, keeps a bad upload cheap to reject

export async function bulkImportMenu(
  _prevState: BulkImportState,
  formData: FormData
): Promise<BulkImportState> {
  const { restaurant, role } = await getCurrentRestaurant()
  // A bulk import can mass-create rows across the whole menu — bigger blast
  // radius than any single create/edit action, so unlike the rest of this
  // file it's worth restricting to the roles that manage the menu at all.
  if (role === 'kitchen_staff' || role === 'waiter') {
    return { errorCode: 'NOT_AUTHORIZED' }
  }

  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return { errorCode: 'EMPTY_CSV_FILE' }
  }
  if (file.size > MAX_CSV_BYTES) {
    return { errorCode: 'CSV_FILE_TOO_LARGE' }
  }

  const text = await file.text()
  const rows = parseCsv(text)
  if (rows.length < 2) {
    return { errorCode: 'INVALID_CSV_FORMAT' }
  }

  const header = rows[0].map(normalizeHeader)
  const colIndex = {
    name: header.indexOf('nombre'),
    description: header.indexOf('descripcion'),
    price: header.indexOf('precio'),
    category: header.indexOf('categoria'),
    station: header.indexOf('estacion'),
    tags: header.indexOf('alergenos'),
    from: header.indexOf('disponible_desde'),
    until: header.indexOf('disponible_hasta'),
  }
  if (colIndex.name === -1 || colIndex.price === -1) {
    return { errorCode: 'INVALID_CSV_FORMAT' }
  }

  const supabase = await createClient()

  const { data: existingCategories } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('restaurant_id', restaurant.id)
  const categoryIdByName = new Map(
    (existingCategories ?? []).map((c) => [c.name.trim().toLowerCase(), c.id])
  )
  let nextCategorySortOrder = await getNextSortOrder(supabase, 'menu_categories', restaurant.id)

  type NewItem = {
    restaurant_id: string
    category_id: string | null
    name: string
    description: string | null
    price_cents: number
    sort_order: number
    dietary_tags: string[]
    available_from: string | null
    available_until: string | null
  }
  const newItems: NewItem[] = []
  let skipped = 0
  let nextItemSortOrder = await getNextSortOrder(supabase, 'menu_items', restaurant.id)

  for (const row of rows.slice(1)) {
    const name = (row[colIndex.name] ?? '').trim()
    const priceRaw = (row[colIndex.price] ?? '').trim().replace(',', '.')
    const priceNumber = Number(priceRaw)

    if (!name || !priceRaw || Number.isNaN(priceNumber) || priceNumber < 0) {
      skipped++
      continue
    }

    let categoryId: string | null = null
    const categoryName = colIndex.category !== -1 ? (row[colIndex.category] ?? '').trim() : ''
    if (categoryName) {
      const key = categoryName.toLowerCase()
      const existing = categoryIdByName.get(key)
      if (existing) {
        categoryId = existing
      } else {
        const stationRaw = (colIndex.station !== -1 ? row[colIndex.station] : '')?.trim().toLowerCase() ?? ''
        const station = stationRaw.includes('bar') ? 'bar' : 'kitchen'
        const { data: created } = await supabase
          .from('menu_categories')
          .insert({
            restaurant_id: restaurant.id,
            name: categoryName,
            station,
            sort_order: nextCategorySortOrder++,
          })
          .select('id')
          .single()
        if (created) {
          categoryId = created.id
          categoryIdByName.set(key, created.id)
        }
      }
    }

    const tagsRaw = colIndex.tags !== -1 ? (row[colIndex.tags] ?? '') : ''
    const dietaryTags = tagsRaw
      .split(/[,;]/)
      .map((t) => t.trim())
      .filter((t) => VALID_DIETARY_TAGS.has(t))

    const fromRaw = colIndex.from !== -1 ? (row[colIndex.from] ?? '').trim() : ''
    const untilRaw = colIndex.until !== -1 ? (row[colIndex.until] ?? '').trim() : ''

    newItems.push({
      restaurant_id: restaurant.id,
      category_id: categoryId,
      name,
      description: colIndex.description !== -1 ? (row[colIndex.description] ?? '').trim() || null : null,
      price_cents: Math.round(priceNumber * 100),
      sort_order: nextItemSortOrder++,
      dietary_tags: dietaryTags,
      available_from: TIME_PATTERN.test(fromRaw) ? fromRaw : null,
      available_until: TIME_PATTERN.test(untilRaw) ? untilRaw : null,
    })
  }

  if (newItems.length > 0) {
    const { error } = await supabase.from('menu_items').insert(newItems)
    if (error) {
      return { errorCode: 'COULD_NOT_CREATE_ITEM' }
    }
  }

  revalidatePath('/admin/menu')
  return { created: newItems.length, skipped }
}
