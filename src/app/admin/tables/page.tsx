import QRCode from 'qrcode'
import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getTableBillSummary } from '@/lib/payments'
import { AddTableForm } from './add-table-form'
import { TableCard } from './table-card'

export default async function TablesPage() {
  const { restaurant } = await requireManagerRole()
  const supabase = await createClient()

  const { data: tables } = await supabase
    .from('tables')
    .select('id, label, qr_token, active')
    .eq('restaurant_id', restaurant.id)
    .order('created_at')

  const tableList = tables ?? []

  const { data: openSessions } = await supabase
    .from('table_sessions')
    .select('id, table_id')
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'open')

  const sessionList = openSessions ?? []
  const sessionIds = sessionList.map((s) => s.id)

  const { data: participants } =
    sessionIds.length > 0
      ? await supabase
          .from('session_participants')
          .select('table_session_id')
          .in('table_session_id', sessionIds)
      : { data: [] }

  const participantCountBySession = new Map<string, number>()
  for (const p of participants ?? []) {
    participantCountBySession.set(
      p.table_session_id,
      (participantCountBySession.get(p.table_session_id) ?? 0) + 1
    )
  }
  const sessionByTableId = new Map(sessionList.map((s) => [s.table_id, s]))

  const tablesWithQr = await Promise.all(
    tableList.map(async (table) => {
      const url = `https://order.kratosystems.com/t/${table.qr_token}`
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 200 })
      const session = sessionByTableId.get(table.id)
      // Same pending-balance check as /admin/floor's board — closing a
      // table from here must warn about an unpaid balance too, not just
      // from Barra, since owner/admin can reach this page just as easily.
      const pendingCents = session ? (await getTableBillSummary(supabase, session.id)).remainingCents : 0
      return {
        ...table,
        url,
        qrDataUrl,
        participantCount: session ? (participantCountBySession.get(session.id) ?? 0) : 0,
        occupied: Boolean(session),
        pendingCents,
      }
    })
  )

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Mesas — {restaurant.name}</h1>

      <AddTableForm />

      {tablesWithQr.length > 0 && (
        <ul className="flex flex-wrap gap-6">
          {tablesWithQr.map((table) => (
            <TableCard
              key={table.id}
              id={table.id}
              label={table.label}
              url={table.url}
              qrDataUrl={table.qrDataUrl}
              occupied={table.occupied}
              participantCount={table.participantCount}
              active={table.active}
              pendingCents={table.pendingCents}
              currency={restaurant.currency}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
