'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'

export type StaffFormState = { error?: string } | undefined

const INVITABLE_ROLES = ['admin', 'kitchen_staff'] as const

export async function inviteStaffMember(
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const { restaurant, role: callerRole } = await getCurrentRestaurant()

  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return { error: 'No tienes permiso para invitar personal.' }
  }

  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? '')

  if (!email) {
    return { error: 'Introduce un email.' }
  }
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
    return { error: 'Elige un rol válido.' }
  }

  const admin = createAdminClient()
  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://order.kratosystems.com/reset-password',
  })

  if (inviteError || !data.user) {
    return { error: 'No se pudo invitar a esta persona (puede que ya tenga cuenta).' }
  }

  const supabase = await createClient()
  const { error: membershipError } = await supabase.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: data.user.id,
    role,
  })

  if (membershipError) {
    return { error: 'La invitación se envió, pero no se pudo asignar al restaurante.' }
  }

  revalidatePath('/admin/staff')
}

export async function removeStaffMember(formData: FormData) {
  const { user, restaurant, role: callerRole } = await getCurrentRestaurant()
  if (callerRole !== 'owner' && callerRole !== 'admin') return

  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()

  const { data: target } = await supabase
    .from('restaurant_users')
    .select('user_id, role')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .single()

  if (!target) return
  if (target.user_id === user.id) return

  if (target.role === 'owner') {
    const { count } = await supabase
      .from('restaurant_users')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurant.id)
      .eq('role', 'owner')
    if ((count ?? 0) <= 1) return
  }

  await supabase.from('restaurant_users').delete().eq('id', id).eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/staff')
}
