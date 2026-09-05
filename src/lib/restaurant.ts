import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type RestaurantRow = {
  id: string
  name: string
  slug: string
  currency: string
  enabled_dietary_tags: string[]
  stripe_account_id: string | null
  stripe_onboarding_complete: boolean
}
type MembershipRow = {
  restaurant_id: string
  role: 'owner' | 'admin' | 'kitchen_staff' | 'waiter'
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

  const { data: membership, error } = await supabase
    .from('restaurant_users')
    .select(
      'restaurant_id, role, restaurants(id, name, slug, currency, enabled_dietary_tags, stripe_account_id, stripe_onboarding_complete)'
    )
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle<MembershipRow>()

  // A real query failure (e.g. a column the DB migration hasn't added yet)
  // must NOT be treated as "no restaurant" — /admin/onboarding runs its own
  // simpler query, finds the membership fine, and bounces back to /admin,
  // which fails the same way again: an infinite redirect loop instead of a
  // visible error.
  if (error) {
    throw new Error(`No se pudo cargar el restaurante: ${error.message}`)
  }

  const restaurant = membership ? toRestaurant(membership.restaurants) : null

  if (!membership || !restaurant) {
    redirect('/admin/onboarding')
  }

  return { user, role: membership.role, restaurant }
}

// Same as getCurrentRestaurant, but also redirects operational roles
// (kitchen_staff, waiter) away — use this at the top of any /admin page
// that isn't their own station's screen. Hiding a nav link isn't access
// control on its own; someone could still type the URL directly.
export async function requireManagerRole() {
  const result = await getCurrentRestaurant()
  if (result.role === 'kitchen_staff') {
    redirect('/admin/kitchen')
  }
  if (result.role === 'waiter') {
    redirect('/admin/floor')
  }
  return result
}
