'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { getVerifiedParticipant } from '@/lib/ordering'

export async function submitFeedback(formData: FormData) {
  const qrToken = String(formData.get('qr_token') ?? '')
  const rating = Number(formData.get('rating') ?? 0)
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return

  const verified = await getVerifiedParticipant(qrToken)
  if (!verified) return

  const admin = createAdminClient()
  await admin
    .from('session_participants')
    .update({ feedback_rating: rating, feedback_submitted_at: new Date().toISOString() })
    .eq('id', verified.participantId)

  revalidatePath(`/t/${qrToken}`)
}
