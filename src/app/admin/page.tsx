import { requireManagerRole } from '@/lib/restaurant'

export default async function AdminHome() {
  const { restaurant } = await requireManagerRole()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{restaurant.name}</h1>
      <p className="text-gray-600">
        Usa el menú de arriba para gestionar tu carta o tus mesas.
      </p>
    </div>
  )
}
