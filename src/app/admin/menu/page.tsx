import { getCurrentRestaurant } from '@/lib/restaurant'
import { createClient } from '@/lib/supabase/server'
import { deleteCategory, deleteMenuItem, toggleMenuItemAvailability } from '@/app/actions/menu'
import { AddCategoryForm } from './add-category-form'
import { AddItemForm } from './add-item-form'

export default async function MenuPage() {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  const [{ data: categories }, { data: items }] = await Promise.all([
    supabase
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order'),
    supabase
      .from('menu_items')
      .select('id, category_id, name, description, price_cents, image_url, is_available')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order'),
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
            {categoryList.map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded border border-gray-300 px-3 py-1"
              >
                <span>{c.name}</span>
                <form action={deleteCategory}>
                  <input type="hidden" name="id" value={c.id} />
                  <button type="submit" className="text-xs text-red-600 underline">
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <AddCategoryForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Platos</h2>
        {itemList.length > 0 && (
          <ul className="flex flex-col gap-2">
            {itemList.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 rounded border border-gray-200 p-3"
              >
                <div>
                  <p className="font-medium">
                    {item.name} — {(item.price_cents / 100).toFixed(2)}€
                    {!item.is_available && (
                      <span className="ml-2 text-xs text-gray-400">(oculto)</span>
                    )}
                  </p>
                  {item.description && (
                    <p className="text-sm text-gray-500">{item.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <form action={toggleMenuItemAvailability}>
                    <input type="hidden" name="id" value={item.id} />
                    <input
                      type="hidden"
                      name="is_available"
                      value={String(item.is_available)}
                    />
                    <button type="submit" className="text-xs underline">
                      {item.is_available ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </form>
                  <form action={deleteMenuItem}>
                    <input type="hidden" name="id" value={item.id} />
                    <button type="submit" className="text-xs text-red-600 underline">
                      Eliminar
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <AddItemForm categories={categoryList} />
      </section>
    </div>
  )
}
