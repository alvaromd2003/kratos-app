'use server'

import { randomUUID } from 'crypto'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { OPTIONAL_PAYMENT_METHODS } from '@/lib/payment-methods'

export type OnboardingFormState = { error?: string } | undefined

const ALLOWED_CURRENCIES = ['EUR', 'GBP', 'USD', 'AED']
const VALID_DIETARY_TAGS = new Set<string>(DIETARY_TAGS.map((t) => t.value))
const VALID_PAYMENT_METHODS = new Set<string>(OPTIONAL_PAYMENT_METHODS.map((m) => m.value))

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

export async function updateRestaurantProfile(
  _prevState: OnboardingFormState,
  formData: FormData
): Promise<OnboardingFormState> {
  const { restaurant } = await getCurrentRestaurant()

  const name = String(formData.get('name') ?? '').trim()
  const currency = String(formData.get('currency') ?? '').trim().toUpperCase()
  const enabledDietaryTags = formData
    .getAll('enabled_dietary_tags')
    .filter((tag): tag is string => typeof tag === 'string' && VALID_DIETARY_TAGS.has(tag))
  const enabledPaymentMethods = formData
    .getAll('enabled_payment_methods')
    .filter((m): m is string => typeof m === 'string' && VALID_PAYMENT_METHODS.has(m))
  const googleReviewUrl = String(formData.get('google_review_url') ?? '').trim() || null

  if (!name) {
    return { error: 'Escribe el nombre de tu restaurante.' }
  }
  if (!ALLOWED_CURRENCIES.includes(currency)) {
    return { error: 'Elige una moneda válida.' }
  }
  // It's rendered straight into an <a href> for every diner who rates
  // 4-5 stars — only http(s) allowed, never e.g. a javascript: URI.
  if (googleReviewUrl && !/^https?:\/\//i.test(googleReviewUrl)) {
    return { error: 'El enlace de reseña debe empezar por http:// o https://' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('restaurants')
    .update({
      name,
      currency,
      enabled_dietary_tags: enabledDietaryTags,
      enabled_payment_methods: enabledPaymentMethods,
      google_review_url: googleReviewUrl,
    })
    .eq('id', restaurant.id)

  if (error) {
    return { error: 'No se pudo actualizar el restaurante.' }
  }

  revalidatePath('/admin/settings')
  revalidatePath('/admin')
}
