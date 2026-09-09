import { getDinerLocale } from '@/lib/i18n/server'
import { dirFor } from '@/lib/i18n/config'
import { dinerDict } from '@/lib/i18n/dictionaries/diner'
import { LocaleProvider } from '@/lib/i18n/provider'

export default async function DinerLayout({ children }: { children: React.ReactNode }) {
  const locale = await getDinerLocale()

  return (
    <div dir={dirFor(locale)} lang={locale}>
      <LocaleProvider locale={locale} dict={dinerDict[locale]}>
        {children}
      </LocaleProvider>
    </div>
  )
}
