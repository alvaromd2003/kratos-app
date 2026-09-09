import { createClient } from '@/lib/supabase/server'

export default async function TrialExpiredPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: membership } = user
    ? await supabase
        .from('restaurant_users')
        .select('restaurants(name)')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle<{ restaurants: { name: string } | { name: string }[] | null }>()
    : { data: null }

  const restaurantRow = membership?.restaurants
  const restaurantName = Array.isArray(restaurantRow)
    ? restaurantRow[0]?.name
    : restaurantRow?.name

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="font-display text-2xl text-ink">Tu prueba gratuita ha terminado</h1>
      <p className="text-sm text-bronze">
        {restaurantName ? `${restaurantName}, ` : ''}
        el mes de prueba gratis de Kratos ha llegado a su fin. Para seguir usando la app,
        ponte en contacto con nosotros y te ayudamos a continuar.
      </p>
      <a
        href="mailto:hola@kratosystems.com"
        className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink"
      >
        hola@kratosystems.com
      </a>
    </div>
  )
}
