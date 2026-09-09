'use client'

import { useActionState } from 'react'
import { updateTable, deleteTable, closeTableSession, toggleTableActive } from '@/app/actions/tables'
import { recordManualPayment } from '@/app/actions/kitchen'
import { formatPrice } from '@/lib/format'
import { useLocale } from '@/lib/i18n/provider'
import { TABLE_ZONES, type TableZone } from '@/lib/table-zones'
import { TABLE_SHAPES, type TableShape } from '@/lib/table-shapes'

export function TableCard({
  id,
  label,
  zone,
  shape,
  url,
  qrDataUrl,
  occupied,
  participantCount,
  active,
  pendingCents,
  currency,
}: {
  id: string
  label: string
  zone: TableZone | null
  shape: TableShape
  url: string
  qrDataUrl: string
  occupied: boolean
  participantCount: number
  active: boolean
  pendingCents: number
  currency: string
}) {
  const { t } = useLocale()
  const [state, action, pending] = useActionState(updateTable, undefined)
  const [deleteState, deleteAction] = useActionState(deleteTable, undefined)

  return (
    <li className="flex w-56 flex-col items-center gap-2.5 rounded-xl border border-marble-3 bg-white p-4 text-center">
      <form action={action} className="flex flex-col items-center gap-2">
        <input type="hidden" name="id" value={id} />
        <input
          key={`label-${label}`}
          name="label"
          defaultValue={label}
          required
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        />
        <select
          key={`zone-${zone ?? 'none'}`}
          name="zone"
          defaultValue={zone ?? ''}
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        >
          <option value="">{t('tables.noZone')}</option>
          {TABLE_ZONES.map((z) => (
            <option key={z} value={z}>
              {t(`zone.${z}`)}
            </option>
          ))}
        </select>
        <select
          key={`shape-${shape}`}
          name="shape"
          defaultValue={shape}
          className="w-28 rounded-lg border border-marble-3 px-2 py-1 text-center text-sm focus:border-ember focus:outline-none"
        >
          {TABLE_SHAPES.map((s) => (
            <option key={s} value={s}>
              {t(`shape.${s}`)}
            </option>
          ))}
        </select>
        <button disabled={pending} type="submit" className="text-xs text-bronze underline">
          {pending ? t('common.saving') : t('common.save')}
        </button>
      </form>
      {state?.errorCode && <p className="text-xs text-rust">{t(`error.${state.errorCode}`)}</p>}
      <div className="rounded-lg border border-marble-3 p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrDataUrl} alt={t('tables.qrAlt', { label })} width={200} height={200} />
      </div>
      <a
        href={qrDataUrl}
        download={`mesa-${label}-kratos.png`}
        className="text-xs text-bronze underline"
      >
        {t('tables.downloadQr')}
      </a>
      <p className="break-all text-xs text-bronze">{url}</p>

      {!active && (
        <span className="rounded-full bg-bronze px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
          {t('floor.deactivated')}
        </span>
      )}

      {occupied ? (
        <div className="flex flex-col items-center gap-2">
          <span className="rounded-full bg-rust px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {t('floor.occupied')} ({participantCount} {participantCount === 1 ? t('common.person') : t('common.people')})
          </span>
          {pendingCents > 0 && (
            <>
              <span className="font-mono text-xs text-ember">
                {t('floor.pending', { amount: formatPrice(pendingCents, currency) })}
              </span>
              <form
                action={recordManualPayment}
                onSubmit={(e) => {
                  if (
                    !confirm(
                      t('floor.cashCollectedConfirm', { amount: formatPrice(pendingCents, currency), label })
                    )
                  ) {
                    e.preventDefault()
                  }
                }}
              >
                <input type="hidden" name="table_id" value={id} />
                <button type="submit" className="text-xs text-bronze underline">
                  {t('floor.cashCollected')}
                </button>
              </form>
            </>
          )}
          <form
            action={closeTableSession}
            onSubmit={(e) => {
              const warning =
                pendingCents > 0
                  ? t('floor.closeConfirmPending', { amount: formatPrice(pendingCents, currency), label })
                  : t('floor.closeConfirmEmpty', { label })
              if (!confirm(warning)) {
                e.preventDefault()
              }
            }}
          >
            <input type="hidden" name="table_id" value={id} />
            <button type="submit" className="text-xs text-bronze underline">
              {t('tables.closeTable')}
            </button>
          </form>
        </div>
      ) : (
        active && (
          <span className="rounded-full bg-sage px-3 py-1 text-xs font-bold uppercase tracking-wide text-white">
            {t('floor.free')}
          </span>
        )
      )}

      <form action={toggleTableActive}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="active" value={String(active)} />
        <button type="submit" className="text-xs text-bronze underline">
          {active ? t('tables.deactivate') : t('tables.reactivate')}
        </button>
      </form>

      <form
        action={deleteAction}
        onSubmit={(e) => {
          if (!confirm(t('tables.deleteTableConfirm', { label }))) {
            e.preventDefault()
          }
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="text-xs text-rust underline">
          {t('tables.deleteTable')}
        </button>
      </form>
      {deleteState?.errorCode && <p className="text-xs text-rust">{t(`error.${deleteState.errorCode}`)}</p>}
    </li>
  )
}
