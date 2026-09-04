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
  const isKitchenOnly = membership?.role === 'kitchen_staff'

  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200">
        <div className="flex items-center justify-between px-6 py-4">
          <Link href={isKitchenOnly ? '/admin/kitchen' : '/admin'} className="font-semibold">
            Kratos Admin
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm underline">
              Salir
            </button>
          </form>
        </div>
        <nav className="flex gap-4 px-6 pb-3 text-sm">
          {isKitchenOnly ? (
            <Link href="/admin/kitchen" className="underline">
              Cocina
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
              <Link href="/admin/staff" className="underline">
                Personal
              </Link>
              <Link href="/admin/settings" className="underline">
                Ajustes
              </Link>
            </>
          )}
        </nav>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
