'use client'

import { useActionState } from 'react'
import { inviteStaffMember } from '@/app/actions/staff'

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteStaffMember, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="staff-email" className="text-sm">
          Email de la persona a invitar
        </label>
        <input
          id="staff-email"
          name="email"
          type="email"
          required
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="staff-role" className="text-sm">
          Rol
        </label>
        <select
          id="staff-role"
          name="role"
          defaultValue="kitchen_staff"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        >
          <option value="kitchen_staff">Cocina</option>
          <option value="waiter">Camarero</option>
          <option value="admin">Administrador</option>
        </select>
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? 'Invitando…' : 'Invitar'}
      </button>
      {state?.error && <p className="w-full text-sm text-rust">{state.error}</p>}
    </form>
  )
}
