'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { closeTableSession } from '@/app/actions/tables'

type Table = { id: string; label: string; occupied: boolean }
type SessionRow = { table_id: string; status: 'open' | 'closed' }

export function TableStatus({
  restaurantId,
  initialTables,
}: {
  restaurantId: string
  initialTables: Table[]
}) {
  const [tables, setTables] = useState(initialTables)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`table-status-${restaurantId}`)
      .on<SessionRow>(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as SessionRow
          setTables((current) =>
            current.map((t) => (t.id === row.table_id ? { ...t, occupied: true } : t))
          )
        }
      )
      .on<SessionRow>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'table_sessions',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          const row = payload.new as SessionRow
          if (row.status !== 'closed') return
          setTables((current) =>
            current.map((t) => (t.id === row.table_id ? { ...t, occupied: false } : t))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [restaurantId])

  if (tables.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-medium">Mesas</h2>
      <ul className="flex flex-wrap gap-3">
        {tables.map((table) => (
          <li
            key={table.id}
            className="flex items-center gap-2 rounded border border-gray-200 px-3 py-2 text-sm"
          >
            <span className="font-medium">Mesa {table.label}</span>
            {table.occupied ? (
              <>
                <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  Ocupada
                </span>
                <form
                  action={closeTableSession}
                  onSubmit={(e) => {
                    if (
                      !confirm(
                        `¿Cerrar la mesa ${table.label}? Los clientes conectados tendrán que volver a escanear el código QR.`
                      )
                    ) {
                      e.preventDefault()
                    }
                  }}
                >
                  <input type="hidden" name="table_id" value={table.id} />
                  <button type="submit" className="text-xs underline">
                    Cerrar
                  </button>
                </form>
              </>
            ) : (
              <span className="rounded bg-green-600 px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                Libre
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
