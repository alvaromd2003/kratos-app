'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveHelpRequest } from '@/app/actions/kitchen'
import { formatTime } from '@/lib/format'

type HelpRequest = {
  id: string
  tableSessionId: string
  tableLabel: string
  createdAt: string
}
type HelpRequestRow = {
  id: string
  table_session_id: string
  status: 'open' | 'resolved'
  created_at: string
}

export function HelpAlerts({
  restaurantId,
  initialRequests,
  tableLabelBySessionId,
}: {
  restaurantId: string
  initialRequests: HelpRequest[]
  tableLabelBySessionId: Record<string, string>
}) {
  const [requests, setRequests] = useState(initialRequests)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`help-requests-${restaurantId}`)
      .on<HelpRequestRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'help_requests',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as HelpRequestRow
          setRequests((current) =>
            current.some((r) => r.id === row.id)
              ? current
              : [
                  ...current,
                  {
                    id: row.id,
                    tableSessionId: row.table_session_id,
                    tableLabel: tableLabelBySessionId[row.table_session_id] ?? '—',
                    createdAt: row.created_at,
                  },
                ]
          )
        }
      )
      .on<HelpRequestRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'help_requests',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as HelpRequestRow
          if (row.status === 'resolved') {
            setRequests((current) => current.filter((r) => r.id !== row.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, tableLabelBySessionId])

  if (requests.length === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded border-2 border-red-600 bg-red-50 p-4">
      <h2 className="font-bold text-red-700">🔔 Avisos de mesas</h2>
      <ul className="flex flex-col gap-2">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">Mesa {req.tableLabel}</span> pide ayuda —{' '}
              {formatTime(req.createdAt)}
            </span>
            <form action={resolveHelpRequest}>
              <input type="hidden" name="id" value={req.id} />
              <button
                type="submit"
                className="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white"
              >
                Atendido
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )
}
