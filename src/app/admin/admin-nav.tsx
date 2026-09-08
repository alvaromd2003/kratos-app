'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const active = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href)

  return (
    <Link
      href={href}
      className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-ember/15 text-ember-bright' : 'text-cream-dim hover:bg-white/5 hover:text-marble-2'
      }`}
    >
      {children}
    </Link>
  )
}

export function AdminNav({ role }: { role: string | undefined }) {
  if (role === 'kitchen_staff') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
        <NavLink href="/admin/kitchen">Cocina</NavLink>
      </nav>
    )
  }

  if (role === 'waiter') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
        <NavLink href="/admin/floor">Barra</NavLink>
      </nav>
    )
  }

  return (
    <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
      <NavLink href="/admin">Resumen</NavLink>
      <NavLink href="/admin/menu">Menú</NavLink>
      <NavLink href="/admin/tables">Mesas</NavLink>
      <NavLink href="/admin/kitchen">Cocina</NavLink>
      <NavLink href="/admin/floor">Barra</NavLink>
      <NavLink href="/admin/history">Historial</NavLink>
      <NavLink href="/admin/stats">Estadísticas</NavLink>
      <NavLink href="/admin/staff">Personal</NavLink>
      <NavLink href="/admin/settings">Ajustes</NavLink>
      <NavLink href="/admin/help">Ayuda</NavLink>
    </nav>
  )
}
