import { formatPrice } from '@/lib/format'
import { dietaryTagLabel } from '@/lib/dietary-tags'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  dietary_tags: string[]
}

export function MenuPreview({
  qrToken,
  tableLabel,
  restaurantName,
  currency,
  enabledTags,
  categories,
  items,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
  currency: string
  enabledTags: string[]
  categories: Category[]
  items: MenuItem[]
}) {
  const itemsByCategory = new Map<string | null, MenuItem[]>()
  for (const item of items) {
    itemsByCategory.set(item.category_id, [...(itemsByCategory.get(item.category_id) ?? []), item])
  }
  const uncategorized = itemsByCategory.get(null) ?? []

  return (
    <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-display text-ink">{restaurantName}</h1>
        <p className="text-sm text-bronze">Mesa {tableLabel} — solo consulta, sin pedir todavía</p>
      </div>

      <a
        href={`/t/${qrToken}`}
        className="self-start rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white"
      >
        Pedir ahora
      </a>

      <section className="flex flex-col gap-6">
        {categories.map((category) => {
          const categoryItems = itemsByCategory.get(category.id) ?? []
          if (categoryItems.length === 0) return null
          return (
            <div key={category.id} className="flex flex-col gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-bronze">
                {category.name}
              </h2>
              <MenuPreviewList items={categoryItems} currency={currency} enabledTags={enabledTags} />
            </div>
          )
        })}
        {uncategorized.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-bronze">Otros</h2>
            <MenuPreviewList items={uncategorized} currency={currency} enabledTags={enabledTags} />
          </div>
        )}
      </section>
      <p className="text-center text-[0.68rem] tracking-wide text-bronze/70">
        Con la tecnología de Kratos Systems
      </p>
    </main>
  )
}

function MenuPreviewList({
  items,
  currency,
  enabledTags,
}: {
  items: MenuItem[]
  currency: string
  enabledTags: string[]
}) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={item.id}
          className="flex items-center gap-3 rounded-xl border border-marble-3 bg-white p-3"
        >
          {item.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.image_url}
              alt={item.name}
              width={56}
              height={56}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-ember-bright to-ember" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-ink">{item.name}</p>
            {item.description && <p className="truncate text-xs text-bronze">{item.description}</p>}
            <p className="font-mono text-xs text-bronze">{formatPrice(item.price_cents, currency)}</p>
            {item.dietary_tags.filter((t) => enabledTags.includes(t)).length > 0 && (
              <p className="text-xs text-bronze">
                {item.dietary_tags
                  .filter((t) => enabledTags.includes(t))
                  .map(dietaryTagLabel)
                  .join(' · ')}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}
