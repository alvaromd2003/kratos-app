import QRCode from 'qrcode'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { deleteTable } from '@/app/actions/tables'
import { AddTableForm } from './add-table-form'

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
            <li
              key={table.id}
              className="flex w-56 flex-col items-center gap-2 rounded border border-gray-200 p-4 text-center"
            >
              <p className="font-medium">{table.label}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={table.qrDataUrl} alt={`Código QR de ${table.label}`} width={200} height={200} />
              <p className="break-all text-xs text-gray-500">{table.url}</p>
              <form action={deleteTable}>
                <input type="hidden" name="id" value={table.id} />
                <button type="submit" className="text-xs text-red-600 underline">
                  Eliminar mesa
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
