'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useLocale } from '@/lib/i18n/provider'

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
  const { t } = useLocale()

  if (role === 'kitchen_staff') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
        <NavLink href="/admin/kitchen">{t('nav.kitchen')}</NavLink>
      </nav>
    )
  }

  if (role === 'waiter') {
    return (
      <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
        <NavLink href="/admin/floor">{t('nav.bar')}</NavLink>
      </nav>
    )
  }

  return (
    <nav className="flex gap-1 overflow-x-auto px-6 pb-3">
      <NavLink href="/admin">{t('nav.summary')}</NavLink>
      <NavLink href="/admin/menu">{t('nav.menu')}</NavLink>
      <NavLink href="/admin/tables">{t('nav.tables')}</NavLink>
      <NavLink href="/admin/kitchen">{t('nav.kitchen')}</NavLink>
      <NavLink href="/admin/floor">{t('nav.bar')}</NavLink>
      <NavLink href="/admin/history">{t('nav.history')}</NavLink>
      <NavLink href="/admin/stats">{t('nav.stats')}</NavLink>
      <NavLink href="/admin/staff">{t('nav.staff')}</NavLink>
      <NavLink href="/admin/settings">{t('nav.settings')}</NavLink>
      <NavLink href="/admin/help">{t('nav.help')}</NavLink>
    </nav>
  )
}
