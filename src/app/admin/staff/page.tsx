import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { removeStaffMember } from '@/app/actions/staff'
import { InviteForm } from './invite-form'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Propietario',
  admin: 'Administrador',
  kitchen_staff: 'Cocina',
}

export default async function StaffPage() {
  const { user, restaurant, role } = await getCurrentRestaurant()
  const supabase = await createClient()

  const { data: members } = await supabase
    .from('restaurant_users')
    .select('id, user_id, role')
    .eq('restaurant_id', restaurant.id)
    .order('created_at', { ascending: true })

  const memberList = members ?? []

  let emailsById: Record<string, string> = {}
  if (memberList.length > 0) {
    const admin = createAdminClient()
    const entries = await Promise.all(
      memberList.map(async (m) => {
        const { data } = await admin.auth.admin.getUserById(m.user_id)
        return [m.user_id, data.user?.email ?? '(desconocido)'] as const
      })
    )
    emailsById = Object.fromEntries(entries)
  }

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Personal — {restaurant.name}</h1>

      <ul className="flex flex-col gap-2">
        {memberList.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3"
          >
            <div>
              <p className="font-medium">{emailsById[m.user_id]}</p>
              <p className="text-sm text-gray-500">{ROLE_LABELS[m.role] ?? m.role}</p>
            </div>
            {canManage && m.user_id !== user.id && (
              <form action={removeStaffMember}>
                <input type="hidden" name="id" value={m.id} />
                <button type="submit" className="text-xs text-red-600 underline">
                  Quitar
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {canManage && <InviteForm />}
    </div>
  )
}
