import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

export async function getActiveTableByQrToken(qrToken: string) {
  const admin = createAdminClient()
  const { data } = await admin
    .from('tables')
    .select('id, restaurant_id, label, active')
    .eq('qr_token', qrToken)
    .eq('active', true)
    .maybeSingle()
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
