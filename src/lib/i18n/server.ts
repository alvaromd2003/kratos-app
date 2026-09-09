import 'server-only'
import { cookies } from 'next/headers'
import { DEFAULT_LOCALE, isValidLocale, type Locale } from './config'

export const DINER_LOCALE_COOKIE = 'kratos_diner_locale'
export const STAFF_LOCALE_COOKIE = 'kratos_staff_locale'

// Two separate cookies (not one shared) so a diner picking English on
// their own phone can never leak into — or be overridden by — a staff
// member's own language choice on the restaurant's shared tablet, even
// if both happen to be open in the same browser at once.
export async function getDinerLocale(): Promise<Locale> {
  const store = await cookies()
  const raw = store.get(DINER_LOCALE_COOKIE)?.value
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE
}

export async function getStaffLocale(): Promise<Locale> {
  const store = await cookies()
  const raw = store.get(STAFF_LOCALE_COOKIE)?.value
  return isValidLocale(raw) ? raw : DEFAULT_LOCALE
}
