import QRCode from 'qrcode'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { AddTableForm } from './add-table-form'
import { TableCard } from './table-card'

export default async function TablesPage() {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  const { data: tables } = await supabase
    .from('tables')
    .select('id, label, qr_token, active')
    .eq('restaurant_id', restaurant.id)
    .order('created_at')

  const tableList = tables ?? []

  const tablesWithQr = await Promise.all(
    tableList.map(async (table) => {
      const url = `https://order.kratosystems.com/t/${table.qr_token}`
      const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 200 })
      return { ...table, url, qrDataUrl }
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
            />
          ))}
        </ul>
      )}
    </div>
  )
}
