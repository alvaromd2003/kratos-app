import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logout } from '@/app/actions/auth'
import { AdminNav } from './admin-nav'

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
    <div className="min-h-screen bg-marble">
      <header className="bg-gradient-to-b from-ink to-ink-2">
        <div className="flex items-center justify-between px-6 py-3">
          <Link href={homeHref} className="flex items-center">
            <Image
              src="/kratos-mark-light.png"
              alt="Kratos"
              width={743}
              height={338}
              priority
              className="h-6 w-auto"
            />
          </Link>
          <form action={logout}>
            <button type="submit" className="text-sm text-cream-dim underline hover:text-marble-2">
              Salir
            </button>
          </form>
        </div>
        <AdminNav role={role} />
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
