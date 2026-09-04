import { requireManagerRole } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { AddCategoryForm } from './add-category-form'
import { AddItemForm } from './add-item-form'
import { CategoryRow } from './category-row'
import { ItemRow } from './item-row'

export default async function MenuPage() {
  const { restaurant } = await requireManagerRole()
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
    supabase
      .from('menu_items')
      .select('id, category_id, name, description, price_cents, image_url, is_available')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ])

  const categoryList = categories ?? []
  const itemList = items ?? []

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Menú — {restaurant.name}</h1>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Categorías</h2>
        {categoryList.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {categoryList.map((c, index) => (
              <CategoryRow
                key={c.id}
                id={c.id}
                name={c.name}
                isFirst={index === 0}
                isLast={index === categoryList.length - 1}
              />
            ))}
          </ul>
        )}
        <AddCategoryForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Platos</h2>
        {itemList.length > 0 && (
          <ul className="flex flex-col gap-2">
            {itemList.map((item, index) => (
              <ItemRow
                key={item.id}
                item={item}
                categories={categoryList}
                isFirst={index === 0}
                isLast={index === itemList.length - 1}
              />
            ))}
          </ul>
        )}
        <AddItemForm categories={categoryList} />
      </section>
    </div>
  )
}
