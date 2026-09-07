'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveTableByQrToken, getVerifiedParticipant } from '@/lib/ordering'

export type LoyaltyFormState = { error?: string } | undefined

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function setLoyaltyEmail(
  _prevState: LoyaltyFormState,
  formData: FormData
): Promise<LoyaltyFormState> {
  const qrToken = String(formData.get('qr_token') ?? '')
  const email = String(formData.get('email') ?? '').trim().toLowerCase()

  if (!EMAIL_PATTERN.test(email)) {
    return { error: 'Escribe un email válido.' }
  }

  const table = await getActiveTableByQrToken(qrToken)
  const verified = table ? await getVerifiedParticipant(qrToken) : null
  if (!table || !verified) {
    return { error: 'Tu sesión en la mesa caducó. Vuelve a escanear el código QR.' }
  }

  const admin = createAdminClient()

  const { error: participantError } = await admin
    .from('session_participants')
    .update({ loyalty_email: email })
    .eq('id', verified.participantId)

  if (participantError) {
    return { error: 'No se pudo guardar el email. Inténtalo de nuevo.' }
  }

  // Upsert without touching stamps if the account already exists —
  // this only needs to guarantee the row exists.
  const { data: existing } = await admin
    .from('loyalty_accounts')
    .select('id')
    .eq('restaurant_id', table.restaurant_id)
    .eq('email', email)
    .maybeSingle()

  if (!existing) {
    await admin.from('loyalty_accounts').insert({
      restaurant_id: table.restaurant_id,
      email,
    })
  }

  revalidatePath(`/t/${qrToken}`)
}
