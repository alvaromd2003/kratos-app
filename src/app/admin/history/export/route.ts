import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { formatDateTime } from '@/lib/format'

const BOM = String.fromCharCode(0xfeff)

function csvEscape(value: string | number): string {
  const str = String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const { restaurant } = await requireManagerRole()

  const supabase = await createClient()
  const orders = await getRestaurantOrders(supabase, restaurant.id)

  const header = [
    'Fecha',
    'Mesa',
    'Estado del pedido',
    'Plato',
    'Cantidad',
    'Precio unitario',
    'Total línea',
    'Cliente',
    'Nota',
  ]

  const rows = orders.flatMap((order) =>
    order.items.map((item) =>
      [
        formatDateTime(order.createdAt),
        order.tableLabel,
        order.status,
        item.dishName,
        item.quantity,
        (item.priceCents / 100).toFixed(2),
        ((item.priceCents * item.quantity) / 100).toFixed(2),
        item.participantName,
        item.note ?? '',
      ]
        .map(csvEscape)
        .join(',')
    )
  )

  const csv = [header.map(csvEscape).join(','), ...rows].join('\n')

  return new Response(BOM + csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="historial-${restaurant.name.replace(/[^a-z0-9]+/gi, '-')}.csv"`,
    },
  })
}
