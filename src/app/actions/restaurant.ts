'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type OnboardingFormState = { error?: string } | undefined

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export async function createRestaurant(
  _prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const name = String(formData.get('name') ?? '').trim()
  if (!name) {
    return { error: 'Escribe el nombre de tu restaurante.' }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  const baseSlug = slugify(name) || 'restaurante'
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`
  // Generated here (not read back from the insert) because RLS won't let
  // this user SELECT the new restaurant until the membership row below
  // exists — a chicken-and-egg problem that only shows up under RLS.
  const restaurantId = randomUUID()

  const { error: restaurantError } = await supabase
    .from('restaurants')
    .insert({ id: restaurantId, name, slug })

  if (restaurantError) {
    return { error: 'No se pudo crear el restaurante. Inténtalo de nuevo.' }
  }

  const { error: membershipError } = await supabase
    .from('restaurant_users')
    .insert({ restaurant_id: restaurantId, user_id: user.id, role: 'owner' })

  if (membershipError) {
    return { error: 'No se pudo asignarte como propietario. Inténtalo de nuevo.' }
  }

  redirect('/admin')
}
