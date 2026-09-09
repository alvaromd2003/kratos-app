'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveHelpRequest } from '@/app/actions/kitchen'
import { formatTime } from '@/lib/format'
import { playAlertSound } from '@/lib/alert-sound'
import { setBadgeCount, clearBadgeCount } from '@/lib/tab-badge'
import { useLocale } from '@/lib/i18n/provider'

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

async function fetchOpenRequests(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  tableLabelBySessionId: Record<string, string>
): Promise<HelpRequest[]> {
  const { data } = await supabase
    .from('help_requests')
    .select('id, table_session_id, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')
    .order('created_at', { ascending: true })

  return (data ?? []).map((h) => ({
    id: h.id,
    tableSessionId: h.table_session_id,
    tableLabel: tableLabelBySessionId[h.table_session_id] ?? '—',
    createdAt: h.created_at,
  }))
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
  const { t } = useLocale()
  const [requests, setRequests] = useState(initialRequests)
  const hasConnectedBefore = useRef(false)

  useEffect(() => {
    setBadgeCount('help-requests', requests.length)
    return () => clearBadgeCount('help-requests')
  }, [requests.length])

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
          playAlertSound()
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
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        fetchOpenRequests(supabase, restaurantId, tableLabelBySessionId).then(setRequests)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, tableLabelBySessionId])

  if (requests.length === 0) return null

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-rust/40 bg-rust-bg p-4">
      <h2 className="font-display text-base text-ink">{t('floor.helpAlertsTitle')}</h2>
      <ul className="flex flex-col gap-2">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-ink">
              <span className="font-medium">
                {t('floor.askingHelp', { table: t('common.table', { label: req.tableLabel }) })}
              </span>{' '}
              <span className="font-mono">{formatTime(req.createdAt)}</span>
            </span>
            <form action={resolveHelpRequest}>
              <input type="hidden" name="id" value={req.id} />
              <button
                type="submit"
                className="rounded-lg bg-rust px-3 py-1.5 text-xs font-medium text-white"
              >
                {t('floor.resolved')}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  )
}
