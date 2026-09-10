import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/i18n/server'
import { interpolate } from '@/lib/i18n/config'
import { staffDict } from '@/lib/i18n/dictionaries/staff'
import { AddCategoryForm } from './add-category-form'
import { AddItemForm } from './add-item-form'
import { ImportMenuForm } from './import-menu-form'
import { CategoryRow } from './category-row'
import { ItemRow } from './item-row'

export default async function MenuPage() {
  const { restaurant } = await requireManagerRole()
  const t = staffDict[await getStaffLocale()]
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name, station')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('menu_items')
      .select(
        'id, category_id, name, description, price_cents, image_url, is_available, dietary_tags, recommended_item_id, available_from, available_until'
      )
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const categoryList = categories ?? []
  const itemList = items ?? []

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-display text-ink">{interpolate(t['menu.title'], { name: restaurant.name })}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">{t['menu.categories']}</h2>
        {categoryList.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {categoryList.map((c, index) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                station={c.station}
                isFirst={index === 0}
                isLast={index === categoryList.length - 1}
              />
            ))}
          </ul>
        )}
        <AddCategoryForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg text-ink">{t['menu.dishes']}</h2>
        {itemList.length > 0 && (
          <ul className="flex flex-col gap-2">
            {itemList.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                categories={categoryList}
                otherItems={itemList.filter((i) => i.id !== item.id)}
                enabledTags={restaurant.enabled_dietary_tags}
                isFirst={index === 0}
                isLast={index === itemList.length - 1}
              />
            ))}
          </ul>
        )}
        <AddItemForm
          categories={categoryList}
          existingItems={itemList}
          enabledTags={restaurant.enabled_dietary_tags}
        />
        <ImportMenuForm />
      </section>
    </div>
  )
}
