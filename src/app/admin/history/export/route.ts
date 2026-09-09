import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getRestaurantOrders } from '@/lib/orders'
import { formatDateTime } from '@/lib/format'
import { getStaffLocale } from '@/lib/i18n/server'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

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
  const t = staffDict[await getStaffLocale()]

  const supabase = await createClient()
  const orders = await getRestaurantOrders(supabase, restaurant.id)

  const header = [
    t['csv.date'],
    t['csv.table'],
    t['csv.orderStatus'],
    t['csv.dish'],
    t['csv.quantity'],
    t['csv.unitPrice'],
    t['csv.lineTotal'],
    t['csv.customer'],
    t['csv.note'],
  ]

  const rows = orders.flatMap((order) =>
    order.items.map((item) =>
      [
        formatDateTime(order.createdAt),
        order.tableLabel,
        t[`orderStatus.${order.status}`] ?? order.status,
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
