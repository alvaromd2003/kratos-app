'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'

export type StaffFormState = { errorCode?: string } | undefined

const INVITABLE_ROLES = ['admin', 'kitchen_staff', 'waiter'] as const

export async function inviteStaffMember(
  _prevState: StaffFormState,
  formData: FormData
): Promise<StaffFormState> {
  const { restaurant, role: callerRole } = await getCurrentRestaurant()

  if (callerRole !== 'owner' && callerRole !== 'admin') {
    return { errorCode: 'NO_PERMISSION_INVITE' }
  }

  const email = String(formData.get('email') ?? '').trim()
  const role = String(formData.get('role') ?? '')

  if (!email) {
    return { errorCode: 'EMPTY_EMAIL' }
  }
  if (!INVITABLE_ROLES.includes(role as (typeof INVITABLE_ROLES)[number])) {
    return { errorCode: 'INVALID_ROLE' }
  }

  const admin = createAdminClient()
  const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: 'https://order.kratosystems.com/reset-password',
  })

  if (inviteError || !data.user) {
    return { errorCode: 'COULD_NOT_INVITE' }
  }

  const supabase = await createClient()
  const { error: membershipError } = await supabase.from('restaurant_users').insert({
    restaurant_id: restaurant.id,
    user_id: data.user.id,
    role,
  })

  if (membershipError) {
    // The invite already created a real auth user and sent a real email
    // before this step — left as-is, that person would click the link,
    // set a password, and land with no restaurant membership at all (and
    // no access code either, so onboarding would be a dead end for them).
    // Delete the orphaned account so the invite can just be retried clean.
    await admin.auth.admin.deleteUser(data.user.id)
    return { errorCode: 'INVITED_NOT_ASSIGNED' }
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
