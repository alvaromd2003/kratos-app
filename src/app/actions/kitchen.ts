'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered'] as const

// Kitchen only moves food through prep; waiter only hands it off once it's
// ready. Owner/admin can do either — useful if someone's filling in.
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  kitchen_staff: ['preparing', 'ready'],
  waiter: ['delivered'],
}

export async function updateOrderStatus(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) return

  if (role !== 'owner' && role !== 'admin' && !ALLOWED_TRANSITIONS[role]?.includes(status)) {
    return
  }

  const supabase = await createClient()
  await supabase.from('orders').update({ status }).eq('id', id).eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/kitchen')
  revalidatePath('/admin/floor')
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

  revalidatePath('/admin/floor')
}

// Only while an order is still "pending" (kitchen hasn't started on it) —
// puts its items back in the diner's open cart instead of just discarding
// them, so they can fix a mistake and resend.
export async function cancelOrderAsStaff(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'kitchen_staff') return

  const id = String(formData.get('id') ?? '')

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!order || order.status !== 'pending') return

  await admin.from('order_items').update({ order_id: null }).eq('order_id', id)
  await admin.from('orders').delete().eq('id', id)

  revalidatePath('/admin/kitchen')
}
