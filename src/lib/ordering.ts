import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getActiveTableByQrToken(qrToken: string) {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tables')
    .select('id, restaurant_id, label, active')
    .eq('qr_token', qrToken)
    .eq('active', true)
    .maybeSingle()

  // A real query failure must not look like "this table doesn't exist" —
  // that shows the diner a 404 (as if the QR code itself were broken)
  // instead of a retryable error.
  if (error) {
    throw new Error(`No se pudo comprobar la mesa: ${error.message}`)
  }

  return data
}

// Confirms a (tableSessionId, participantId) pair — as stored in the
// diner's cookie — really belongs to this table and is still open, before
// any read or write trusts it.
export async function getOpenSessionParticipant(
  tableId: string,
  tableSessionId: string,
  participantId: string
) {
  const admin = createAdminClient()

  const { data: session } = await admin
    .from('table_sessions')
    .select('id')
    .eq('id', tableSessionId)
    .eq('table_id', tableId)
    .eq('status', 'open')
    .maybeSingle()
  if (!session) return null

  const { data: participant } = await admin
    .from('session_participants')
    .select('id, name')
    .eq('id', participantId)
    .eq('table_session_id', session.id)
    .maybeSingle()
  if (!participant) return null

  return { session, participant }
}
