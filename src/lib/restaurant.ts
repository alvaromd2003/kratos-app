import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type RestaurantRow = { id: string; name: string; slug: string }
type MembershipRow = {
  restaurant_id: string
  role: 'owner' | 'admin' | 'kitchen_staff'
  restaurants: RestaurantRow | RestaurantRow[] | null
}

function toRestaurant(row: MembershipRow['restaurants']): RestaurantRow | null {
  if (!row) return null
  return Array.isArray(row) ? (row[0] ?? null) : row
}

// Redirects to /login if there's no session, or to /admin/onboarding if the
// user hasn't created a restaurant yet. Use this at the top of any /admin
// page that requires an existing restaurant.
export async function getCurrentRestaurant() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: membership } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, role, restaurants(id, name, slug)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle<MembershipRow>()

  const restaurant = membership ? toRestaurant(membership.restaurants) : null

  if (!membership || !restaurant) {
    redirect('/admin/onboarding')
  }

  return { user, role: membership.role, restaurant }
}
