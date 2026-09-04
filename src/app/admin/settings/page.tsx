import { getCurrentRestaurant } from '@/lib/restaurant'
import { SettingsForm } from './settings-form'

export default async function SettingsPage() {
  const { restaurant } = await getCurrentRestaurant()

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Ajustes — {restaurant.name}</h1>
      <SettingsForm name={restaurant.name} currency={restaurant.currency} />
    </div>
  )
}
