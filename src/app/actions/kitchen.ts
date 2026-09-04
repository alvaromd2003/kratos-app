'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered'] as const

export async function updateOrderStatus(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'kitchen_staff') return

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) return

  const supabase = await createClient()
  await supabase.from('orders').update({ status }).eq('id', id).eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/kitchen')
}

export async function resolveHelpRequest(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase
    .from('help_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/kitchen')
}
