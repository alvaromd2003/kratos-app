import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffLocale } from '@/lib/i18n/server'
import { interpolate } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'
import { RemoveStaffButton } from './remove-staff-button'
import { InviteForm } from './invite-form'

export default async function StaffPage() {
  const { user, restaurant, role } = await requireManagerRole()
  const t = staffDict[await getStaffLocale()]
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
        return [m.user_id, data.user?.email ?? t['staff.unknown']] as const
      })
    )
    emailsById = Object.fromEntries(entries)
  }

  const canManage = role === 'owner' || role === 'admin'

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-display text-ink">{interpolate(t['staff.title'], { name: restaurant.name })}</h1>

      <ul className="flex flex-col gap-2">
        {memberList.map((m) => (
          <li
            key={m.id}
            className="flex items-center justify-between gap-4 rounded-xl border border-marble-3 bg-white p-4"
          >
            <div>
              <p className="font-medium text-ink">{emailsById[m.user_id]}</p>
              <p className="text-sm text-bronze">{t[`role.${m.role}`] ?? m.role}</p>
            </div>
            {canManage && m.user_id !== user.id && (
              <RemoveStaffButton id={m.id} label={emailsById[m.user_id]} />
            )}
          </li>
        ))}
      </ul>

      {canManage && <InviteForm />}
    </div>
  )
}
