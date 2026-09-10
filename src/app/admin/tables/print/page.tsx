import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { generateTableQrDataUrl } from '@/lib/qr'
import { getStaffLocale } from '@/lib/i18n/server'
import { interpolate } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'

export default async function PrintAllQrPage() {
  const { restaurant } = await requireManagerRole()
  const t = staffDict[await getStaffLocale()]
  const supabase = await createClient()

  const { data: tables } = await supabase
    .from('tables')
    .select('id, label, qr_token')
    .eq('restaurant_id', restaurant.id)
    .eq('active', true)
    .order('created_at')

  const tablesWithQr = await Promise.all(
    (tables ?? []).map(async (table) => ({
      ...table,
      qrDataUrl: await generateTableQrDataUrl(`https://order.kratosystems.com/t/${table.qr_token}`),
    }))
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-6 print:px-0 print:py-0">
      <h1 className="mb-6 text-xl font-display text-ink print:mb-4">
        {interpolate(t['tables.printPageTitle'], { name: restaurant.name })}
      </h1>
      <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 print:grid-cols-3 print:gap-6">
        {tablesWithQr.map((table) => (
          <div
            key={table.id}
            className="flex flex-col items-center gap-2 break-inside-avoid rounded-lg border border-marble-3 p-4 print:border-0"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={table.qrDataUrl} alt={table.label} width={180} height={180} className="h-auto w-full max-w-[180px]" />
            <span className="text-sm font-semibold text-ink">{table.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
