import Link from 'next/link'
import { getCurrentRestaurant } from '@/lib/restaurant'

export default async function AdminHome() {
  const { restaurant } = await getCurrentRestaurant()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{restaurant.name}</h1>
      <nav className="flex gap-4">
        <Link href="/admin/menu" className="underline">
          Menú
        </Link>
        <Link href="/admin/tables" className="underline">
          Mesas
        </Link>
      </nav>
    </div>
  )
}
