import 'server-only'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export function dinerCookieName(qrToken: string) {
  return `td_${qrToken}`
}

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

// The one place every diner-facing write re-derives and re-verifies who's
// asking — never trust the cookie's ids without checking them against the
// DB (see getOpenSessionParticipant above).
export async function getVerifiedParticipant(qrToken: string) {
  const store = await cookies()
  const raw = store.get(dinerCookieName(qrToken))?.value
  if (!raw) return null
  const [participantId, tableSessionId] = raw.split(':')
  if (!participantId || !tableSessionId) return null

  const table = await getActiveTableByQrToken(qrToken)
  if (!table) return null

  const verified = await getOpenSessionParticipant(table.id, tableSessionId, participantId)
  if (!verified) return null

  return { participantId: verified.participant.id, tableSessionId: verified.session.id }
}
