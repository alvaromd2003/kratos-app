'use client'

import { removeStaffMember } from '@/app/actions/staff'

export function RemoveStaffButton({ id, label }: { id: string; label: string }) {
  return (
    <form
      action={removeStaffMember}
      onSubmit={(e) => {
        if (!confirm(`¿Seguro que quieres quitar a ${label} del equipo?`)) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-rust underline">
        Quitar
      </button>
    </form>
  )
}
