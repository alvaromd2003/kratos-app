'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { confirmCashPayment, rejectCashPayment } from '@/app/actions/kitchen'
import { formatPrice, formatTime } from '@/lib/format'
import { playAlertSound } from '@/lib/alert-sound'
import { setBadgeCount, clearBadgeCount } from '@/lib/tab-badge'

type CashRequest = {
  id: string
  tableSessionId: string
  tableLabel: string
  amountCents: number
  createdAt: string
}
type PaymentShareRow = {
  id: string
  table_session_id: string
  mode: string
  status: string
  charged_cents: number
  created_at: string
}

async function fetchPendingCashRequests(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  tableLabelBySessionId: Record<string, string>
): Promise<CashRequest[]> {
  const { data } = await supabase
    .from('payment_shares')
    .select('id, table_session_id, charged_cents, created_at')
    .eq('restaurant_id', restaurantId)
    .eq('mode', 'cash')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  return (data ?? []).map((c) => ({
    id: c.id,
    tableSessionId: c.table_session_id,
    tableLabel: tableLabelBySessionId[c.table_session_id] ?? '—',
    amountCents: c.charged_cents,
    createdAt: c.created_at,
  }))
}

export function CashPaymentAlerts({
  restaurantId,
  initialRequests,
  tableLabelBySessionId,
  currency,
}: {
  restaurantId: string
  initialRequests: CashRequest[]
  tableLabelBySessionId: Record<string, string>
  currency: string
}) {
  const [requests, setRequests] = useState(initialRequests)
  const hasConnectedBefore = useRef(false)

  useEffect(() => {
    setBadgeCount('cash-payments', requests.length)
    return () => clearBadgeCount('cash-payments')
  }, [requests.length])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`cash-payments-${restaurantId}`)
      .on<PaymentShareRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'payment_shares',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as PaymentShareRow
          if (row.mode !== 'cash' || row.status !== 'pending') return
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
                    amountCents: row.charged_cents,
                    createdAt: row.created_at,
                  },
                ]
          )
        }
      )
      .on<PaymentShareRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'payment_shares',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as PaymentShareRow
          if (row.status !== 'pending') {
            setRequests((current) => current.filter((r) => r.id !== row.id))
          }
        }
      )
      .on<Partial<PaymentShareRow>>(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'payment_shares',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const old = payload.old as Partial<PaymentShareRow>
          setRequests((current) => current.filter((r) => r.id !== old.id))
        }
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        fetchPendingCashRequests(supabase, restaurantId, tableLabelBySessionId).then(setRequests)
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId, tableLabelBySessionId])

  if (requests.length === 0) return null

  return (
    <section className="flex flex-col gap-2 rounded border-2 border-amber-600 bg-amber-50 p-4">
      <h2 className="font-bold text-amber-800">💵 Pagos en efectivo pendientes de confirmar</h2>
      <ul className="flex flex-col gap-2">
        {requests.map((req) => (
          <li key={req.id} className="flex items-center justify-between gap-3 text-sm">
            <span>
              <span className="font-medium">Mesa {req.tableLabel}</span> —{' '}
              {formatPrice(req.amountCents, currency)} — {formatTime(req.createdAt)}
            </span>
            <span className="flex gap-2">
              <form action={confirmCashPayment}>
                <input type="hidden" name="id" value={req.id} />
                <button
                  type="submit"
                  className="rounded bg-amber-700 px-3 py-1 text-xs font-medium text-white"
                >
                  Confirmar cobro
                </button>
              </form>
              <form action={rejectCashPayment}>
                <input type="hidden" name="id" value={req.id} />
                <button type="submit" className="rounded border border-gray-400 px-3 py-1 text-xs">
                  Rechazar
                </button>
              </form>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
