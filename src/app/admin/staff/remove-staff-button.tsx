'use client'

import { removeStaffMember } from '@/app/actions/staff'
import { useLocale } from '@/lib/i18n/provider'

export function RemoveStaffButton({ id, label }: { id: string; label: string }) {
  const { t } = useLocale()
  return (
    <form
      action={removeStaffMember}
      onSubmit={(e) => {
        if (!confirm(t('staff.removeConfirm', { label }))) {
          e.preventDefault()
        }
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-xs text-rust underline">
        {t('staff.remove')}
      </button>
    </form>
  )
}
