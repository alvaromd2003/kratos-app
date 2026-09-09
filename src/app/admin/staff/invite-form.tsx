'use client'

import { useActionState } from 'react'
import { inviteStaffMember } from '@/app/actions/staff'
import { useLocale } from '@/lib/i18n/provider'

export function InviteForm() {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(inviteStaffMember, undefined)

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="staff-email" className="text-sm">
          {t('staff.inviteEmail')}
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
          {t('staff.role')}
        </label>
        <select
          id="staff-role"
          name="role"
          defaultValue="kitchen_staff"
          className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
        >
          <option value="kitchen_staff">{t('role.kitchen_staff')}</option>
          <option value="waiter">{t('role.waiter')}</option>
          <option value="admin">{t('role.admin')}</option>
        </select>
      </div>
      <button
        disabled={pending}
        type="submit"
        className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {pending ? t('staff.inviting') : t('staff.invite')}
      </button>
      {state?.errorCode && <p className="w-full text-sm text-rust">{t(`error.${state.errorCode}`)}</p>}
    </form>
  )
}
