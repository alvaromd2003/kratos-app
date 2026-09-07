import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Best-effort only — no redirect here even if there's no membership yet,
  // since this layout also wraps /admin/onboarding itself.
  const { data: membership } = await supabase
    .from('restaurant_users')
    .select('role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  const role = membership?.role

  // Each operational role gets exactly one screen — the one matching what
  // that job actually does. Owner/admin see everything.
  const homeHref = role === 'kitchen_staff' ? '/admin/kitchen' : role === 'waiter' ? '/admin/floor' : '/admin'

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href={homeHref} className="font-semibold">
            Kratos Admin
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm underline">
              Salir
            </button>
          </form>
        </div>
        <nav className="flex gap-4 px-6 pb-3 text-sm">
          {role === 'kitchen_staff' ? (
            <Link href="/admin/kitchen" className="underline">
              Cocina
            </Link>
          ) : role === 'waiter' ? (
            <Link href="/admin/floor" className="underline">
              Barra
            </Link>
          ) : (
            <>
              <Link href="/admin" className="underline">
                Resumen
              </Link>
              <Link href="/admin/menu" className="underline">
                Menú
              </Link>
              <Link href="/admin/tables" className="underline">
                Mesas
              </Link>
              <Link href="/admin/kitchen" className="underline">
                Cocina
              </Link>
              <Link href="/admin/floor" className="underline">
                Barra
              </Link>
              <Link href="/admin/history" className="underline">
                Historial
              </Link>
              <Link href="/admin/stats" className="underline">
                Estadísticas
              </Link>
              <Link href="/admin/staff" className="underline">
                Personal
              </Link>
              <Link href="/admin/settings" className="underline">
                Ajustes
              </Link>
              <Link href="/admin/help" className="underline">
                Ayuda
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
