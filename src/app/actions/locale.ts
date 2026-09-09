'use server'

import { cookies } from 'next/headers'
import { isValidLocale } from '@/lib/i18n/config'
import { DINER_LOCALE_COOKIE, STAFF_LOCALE_COOKIE } from '@/lib/i18n/server'

const ONE_YEAR = 60 * 60 * 24 * 365

export async function setDinerLocale(formData: FormData) {
  const locale = String(formData.get('locale') ?? '')
  if (!isValidLocale(locale)) return
  const store = await cookies()
  store.set(DINER_LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, sameSite: 'lax' })
}

export async function setStaffLocale(formData: FormData) {
  const locale = String(formData.get('locale') ?? '')
  if (!isValidLocale(locale)) return
  const store = await cookies()
  store.set(STAFF_LOCALE_COOKIE, locale, { maxAge: ONE_YEAR, sameSite: 'lax' })
}
