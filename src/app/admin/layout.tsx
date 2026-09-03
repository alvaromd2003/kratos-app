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

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
        <span className="font-semibold">Kratos Admin</span>
        <form action={logout}>
          <button type="submit" className="text-sm underline">
            Salir
          </button>
        </form>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
