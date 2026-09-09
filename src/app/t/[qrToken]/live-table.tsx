'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { formatPrice, formatTime } from '@/lib/format'
import { DIETARY_TAGS } from '@/lib/dietary-tags'
import { requestCancelOrder, getTableSessionSnapshot } from '@/app/actions/ordering'
import { useLocale } from '@/lib/i18n/provider'
import { AddItemButton } from './add-item-button'
import { CartItemRow } from './cart-item-row'
import { SendOrderButton } from './send-order-button'
import { HelpButton } from './help-button'
import { PaymentPanel } from './payment-panel'
import { LoyaltyPanel } from './loyalty-panel'
import { ItemizedPaymentPanel } from './itemized-payment-panel'
import { LanguageSwitcher } from './language-switcher'

type Category = { id: string; name: string }
type MenuItem = {
  id: string
  category_id: string | null
  name: string
  description: string | null
  price_cents: number
  image_url: string | null
  dietary_tags: string[]
  recommended_item_id: string | null
}
type Participant = { id: string; name: string }
type OrderItemRow = {
  id: string
  menu_item_id: string
  participant_id: string
  quantity: number
  order_id: string | null
  note: string | null
  price_cents: number
}
type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivered'
type OrderRow = {
  id: string
  status: OrderStatus
  created_at: string
  cancellation_requested_at: string | null
}
type ActiveOrderRow = { id: string; status: OrderStatus; created_at: string }
type PaymentMode = 'individual' | 'split' | 'collective' | 'cash'
type PaymentShareRow = {
  id: string
  participant_id: string
  mode: PaymentMode
  amount_cents: number
  status: 'pending' | 'succeeded' | 'failed'
}

export function LiveTable({
  qrToken,
  tableLabel,
  restaurantName,
  currency,
  enabledTags,
  participantId,
  categories,
  items,
  initialParticipants,
  initialOrderItems,
  initialOrders,
  initialRestaurantActiveOrders,
  stripeOnboardingComplete,
  initialPaymentShares,
  paymentResult,
  avgWaitMinutes,
  loyaltyEmail,
  loyaltyStamps,
  googleReviewUrl,
  hasSubmittedFeedback,
  orderItemCoverage: initialOrderItemCoverage,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
  currency: string
  enabledTags: string[]
  participantId: string
  categories: Category[]
  items: MenuItem[]
  initialParticipants: Participant[]
  initialOrderItems: OrderItemRow[]
  initialOrders: OrderRow[]
  initialRestaurantActiveOrders: ActiveOrderRow[]
  stripeOnboardingComplete: boolean
  initialPaymentShares: PaymentShareRow[]
  paymentResult: 'success' | 'cancelled' | null
  avgWaitMinutes: number | null
  loyaltyEmail: string | null
  loyaltyStamps: number
  googleReviewUrl: string | null
  hasSubmittedFeedback: boolean
  // order_item_id -> who has paid how much of that line via the itemized
  // mode (absent/empty = untouched, sum < full price = partially split
  // already). Kept as a list of contributions rather than a running
  // total so the picker can show *who* already covered part of a shared
  // dish, not just how much is left.
  orderItemCoverage: Record<string, { participantId: string; amountCents: number }[]>
}) {
  const { t } = useLocale()
  const [participants, setParticipants] = useState(initialParticipants)
  const [orderItems, setOrderItems] = useState(initialOrderItems)
  const [orders, setOrders] = useState(initialOrders)
  const [restaurantActiveOrders, setRestaurantActiveOrders] = useState(
    initialRestaurantActiveOrders
  )
  const [paymentShares, setPaymentShares] = useState(initialPaymentShares)
  const [orderItemCoverage, setOrderItemCoverage] = useState(initialOrderItemCoverage)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())

  const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
    pending: t('orders.status.pending'),
    preparing: t('orders.status.preparing'),
    ready: t('orders.status.ready'),
    delivered: t('orders.status.delivered'),
  }

  // Polls a verified snapshot of this table's own session instead of
  // subscribing directly to Supabase Realtime with the anon key — the
  // browser is never authenticated as a specific diner, so an anon-key
  // Realtime/SELECT policy broad enough to power a live subscription had
  // no way to check WHICH session the caller belonged to, and ended up
  // readable by anyone on the internet for every restaurant (see the
  // migration removing those policies). getTableSessionSnapshot re-derives
  // and re-verifies the caller's own session from their cookie, the same
  // way every write already does, so only this table's own data can ever
  // come back. A few seconds of lag instead of instant push, in exchange
  // for closing that leak.
  useEffect(() => {
    let cancelled = false

    async function poll() {
      const snapshot = await getTableSessionSnapshot(qrToken)
      if (cancelled || !snapshot) return
      setOrderItems(snapshot.orderItems)
      setParticipants(snapshot.participants)
      setOrders(snapshot.orders)
      setPaymentShares(snapshot.paymentShares)
      setRestaurantActiveOrders(snapshot.restaurantActiveOrders)
      setOrderItemCoverage(snapshot.orderItemCoverage)
    }

    poll()
    const interval = setInterval(poll, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [qrToken])

  const itemsById = new Map(items.map((item) => [item.id, item]))
  const participantsById = new Map(participants.map((p) => [p.id, p]))

  const visibleItems = useMemo(() => {
    if (activeTags.size === 0) return items
    return items.filter((item) => [...activeTags].every((tag) => item.dietary_tags.includes(tag)))
  }, [items, activeTags])

  const itemsByCategory = new Map<string | null, MenuItem[]>()
  for (const item of visibleItems) {
    itemsByCategory.set(item.category_id, [...(itemsByCategory.get(item.category_id) ?? []), item])
  }
  const uncategorized = itemsByCategory.get(null) ?? []

  // Items already sent to the kitchen leave the editable cart — the diner
  // can still start a new round (drinks, dessert…) underneath. The running
  // total, though, always covers everything ordered this sitting, sent or
  // not — a diner should never lose track of what the table has spent.
  const cartItems = orderItems.filter((row) => row.order_id === null)

  // The price snapshotted when the dish was added — never a live
  // menu_items lookup, so a later price edit can't change what this
  // table already owes for it (matches the server-side bill math in
  // src/lib/payments.ts).
  const lineTotal = (row: OrderItemRow) => row.price_cents * row.quantity
  const cartTotal = cartItems.reduce((sum, row) => sum + lineTotal(row), 0)
  const tableTotal = orderItems.reduce((sum, row) => sum + lineTotal(row), 0)

  // Every successful payment, whichever of the 3 modes paid it, reduces
  // this same shared balance — see src/lib/payments.ts for the mirrored
  // server-side version used when actually creating a charge.
  const succeededShares = paymentShares.filter((s) => s.status === 'succeeded')
  const paidCents = succeededShares.reduce((sum, s) => sum + s.amount_cents, 0)
  const remainingCents = Math.max(0, tableTotal - paidCents)
  const mySubtotal = orderItems
    .filter((row) => row.participant_id === participantId)
    .reduce((sum, row) => sum + lineTotal(row), 0)
  const myPaidIndividual = succeededShares
    .filter((s) => s.participant_id === participantId && s.mode === 'individual')
    .reduce((sum, s) => sum + s.amount_cents, 0)
  const individualDueCents = Math.max(0, Math.min(remainingCents, mySubtotal - myPaidIndividual))
  // Whether THIS diner has already completed any payment of their own —
  // used to offer the feedback survey right when they're done, instead of
  // making them wait for the whole table's balance to hit zero (which can
  // take a while longer if others at the table haven't paid yet).
  const myPaidCents = succeededShares
    .filter((s) => s.participant_id === participantId)
    .reduce((sum, s) => sum + s.amount_cents, 0)
  const pendingCash = paymentShares.find((s) => s.mode === 'cash' && s.status === 'pending')
  const pendingCashAmountCents = pendingCash?.amount_cents ?? null

  // Display-only mirror of LOYALTY_STAMP_THRESHOLD/LOYALTY_DISCOUNT_PERCENT
  // in src/lib/loyalty.ts (a server-only module, can't be imported here) —
  // the actual charge is always computed authoritatively server-side
  // regardless of this; this only keeps what the buttons show from
  // silently diverging from what Stripe will actually charge.
  const loyaltyDiscountPercent = loyaltyStamps >= 10 ? 10 : 0

  const participantLabel = (id: string) => {
    if (id === participantId) return t('payment.you')
    return participantsById.get(id)?.name ?? '—'
  }

  // Only what's left unpaid on each line is shown — a dish already
  // partially split by someone else automatically offers just the rest,
  // no need for everyone to agree on a share count up front (mirrors
  // splitAmountDue's same "divide what's currently left" logic).
  const pickableItems = orderItems
    .map((row) => {
      const item = itemsById.get(row.menu_item_id)
      if (!item) return null
      const fullCents = item.price_cents * row.quantity
      const contributions = orderItemCoverage[row.id] ?? []
      const coveredCents = contributions.reduce((sum, c) => sum + c.amountCents, 0)
      const itemRemainingCents = fullCents - coveredCents
      if (itemRemainingCents <= 0) return null
      return {
        id: row.id,
        name: item.name,
        remainingCents: itemRemainingCents,
        participantLabel: participantLabel(row.participant_id),
        contributors: contributions.map((c) => ({
          label: participantLabel(c.participantId),
          amountCents: c.amountCents,
        })),
      }
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)

  // Who can be picked as part of a dish split. Excludes "Pedido en barra",
  // the staff-assisted-ordering pseudo-participant (see staff-order.ts) —
  // it's never a real person who can pay their share.
  const splittableParticipants = participants
    .filter((p) => p.name !== 'Pedido en barra')
    .map((p) => ({ id: p.id, label: participantLabel(p.id) }))

  const sortedOrders = [...orders].sort((a, b) => a.created_at.localeCompare(b.created_at))

  function queuePosition(order: OrderRow): number {
    return restaurantActiveOrders.filter(
      (o) => o.id !== order.id && o.created_at < order.created_at
    ).length
  }

  function toggleTag(tag: string) {
    setActiveTags((current) => {
      const next = new Set(current)
      if (next.has(tag)) {
        next.delete(tag)
      } else {
        next.add(tag)
      }
      return next
    })
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-6 pb-56">
      <LanguageSwitcher />
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-b from-ink to-ink-2 px-5 py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-display text-white">{restaurantName}</h1>
          <p className="text-sm text-cream-dim">
            {t('join.tableLabel', { label: tableLabel })} ·{' '}
            {participants.map((p) => participantLabel(p.id)).join(', ')}
          </p>
        </div>
        <p className="text-sm font-medium text-marble-2">
          {t('table.total')}{' '}
          <span className="font-mono">{formatPrice(tableTotal, currency)}</span>
        </p>
        <HelpButton qrToken={qrToken} />
      </div>

      <LoyaltyPanel qrToken={qrToken} loyaltyEmail={loyaltyEmail} stamps={loyaltyStamps} />

      {stripeOnboardingComplete && (
        <>
          <PaymentPanel
            qrToken={qrToken}
            currency={currency}
            tableTotalCents={tableTotal}
            remainingCents={remainingCents}
            individualDueCents={individualDueCents}
            defaultShareCount={participants.length}
            paymentResult={paymentResult}
            pendingCashAmountCents={pendingCashAmountCents}
            hasSubmittedFeedback={hasSubmittedFeedback}
            googleReviewUrl={googleReviewUrl}
            loyaltyDiscountPercent={loyaltyDiscountPercent}
            myPaidCents={myPaidCents}
          />
          {remainingCents > 0 && pendingCashAmountCents === null && (
            <ItemizedPaymentPanel
              qrToken={qrToken}
              currency={currency}
              items={pickableItems}
              loyaltyDiscountPercent={loyaltyDiscountPercent}
              tableParticipants={splittableParticipants}
              currentParticipantId={participantId}
            />
          )}
        </>
      )}

      {sortedOrders.length > 0 && (
        <section className="flex flex-col gap-3 rounded-xl border border-marble-3 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base text-ink">{t('orders.title')}</h2>
            {avgWaitMinutes !== null && (
              <span className="text-xs text-bronze">
                {t('orders.avgWait', { min: avgWaitMinutes })}
              </span>
            )}
          </div>
          <ul className="flex flex-col gap-3 text-sm">
            {sortedOrders.map((order) => {
              const orderRows = orderItems.filter((row) => row.order_id === order.id)
              const ahead = order.status === 'pending' ? queuePosition(order) : 0
              return (
                <li key={order.id} className="flex flex-col gap-0.5 border-t border-marble-2 pt-3 first:border-t-0 first:pt-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-ink">
                      <span className="font-mono text-xs text-bronze">{formatTime(order.created_at)}</span>{' '}
                      — {ORDER_STATUS_LABEL[order.status]}
                      {order.status === 'pending' && (
                        <span className="text-bronze">
                          {' '}
                          ({ahead > 0 ? t('orders.aheadInQueue', { n: ahead }) : t('orders.nextUp')})
                        </span>
                      )}
                    </p>
                    {order.status === 'pending' &&
                      (order.cancellation_requested_at ? (
                        <span className="text-xs text-bronze">{t('orders.cancelRequested')}</span>
                      ) : (
                        <form
                          action={requestCancelOrder}
                          onSubmit={(e) => {
                            if (!confirm(t('orders.cancelConfirm'))) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <input type="hidden" name="qr_token" value={qrToken} />
                          <input type="hidden" name="order_id" value={order.id} />
                          <button type="submit" className="text-xs text-rust underline">
                            {t('orders.cancel')}
                          </button>
                        </form>
                      ))}
                  </div>
                  <p className="text-xs text-bronze">
                    {orderRows
                      .map((row) => `${row.quantity}× ${itemsById.get(row.menu_item_id)?.name ?? '—'}`)
                      .join(', ')}
                  </p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-2">
        {DIETARY_TAGS.filter((tag) => enabledTags.includes(tag.value)).map((tag) => (
          <button
            key={tag.value}
            type="button"
            onClick={() => toggleTag(tag.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              activeTags.has(tag.value)
                ? 'border-ember bg-ember text-ink'
                : 'border-marble-3 text-bronze hover:border-cream-dim'
            }`}
          >
            {t(`dietary.${tag.value}`)}
          </button>
        ))}
      </div>

      <section className="flex flex-col gap-6">
        {categories.map((category) => {
          const categoryItems = itemsByCategory.get(category.id) ?? []
          if (categoryItems.length === 0) return null
          return (
            <MenuSection
              key={category.id}
              title={category.name}
              items={categoryItems}
              qrToken={qrToken}
              currency={currency}
              itemsById={itemsById}
              enabledTags={enabledTags}
            />
          )
        })}
        {uncategorized.length > 0 && (
          <MenuSection
            title={t('preview.other')}
            items={uncategorized}
            qrToken={qrToken}
            currency={currency}
            itemsById={itemsById}
            enabledTags={enabledTags}
          />
        )}
        {visibleItems.length === 0 && (
          <p className="text-sm text-gray-500">{t('orders.noMatch')}</p>
        )}
      </section>

      <section className="fixed inset-x-0 bottom-0 mx-auto flex max-h-64 w-full max-w-md flex-col gap-3 rounded-t-2xl border-t border-marble-3 bg-white px-5 py-4 text-ink shadow-[0_-8px_24px_rgba(11,25,44,0.1)]">
        <h2 className="font-display text-base text-ink">{t('cart.title')}</h2>
        {cartItems.length === 0 ? (
          <p className="text-sm text-bronze">{t('cart.empty')}</p>
        ) : (
          <ul className="flex flex-col gap-2 overflow-y-auto">
            {cartItems.map((row) => {
              const item = itemsById.get(row.menu_item_id)
              if (!item) return null
              return (
                <CartItemRow
                  key={row.id}
                  qrToken={qrToken}
                  orderItemId={row.id}
                  name={`${item.name} — ${participantLabel(row.participant_id)}`}
                  quantity={row.quantity}
                  note={row.note}
                  lineTotal={formatPrice(row.price_cents * row.quantity, currency)}
                />
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            {t('cart.total')}{' '}
            <span className="font-mono">{formatPrice(cartTotal, currency)}</span>
          </p>
          {cartItems.length > 0 && <SendOrderButton qrToken={qrToken} />}
        </div>
        <p className="flex items-center justify-center gap-1.5 text-center text-[0.68rem] tracking-wide text-bronze/70">
          <Image src="/kratos-badge.png" alt="" width={40} height={40} className="h-3.5 w-3.5 rounded-[3px]" />
          {t('poweredBy')}
        </p>
      </section>
    </main>
  )
}

function MenuSection({
  title,
  items,
  qrToken,
  currency,
  itemsById,
  enabledTags,
}: {
  title: string
  items: MenuItem[]
  qrToken: string
  currency: string
  itemsById: Map<string, MenuItem>
  enabledTags: string[]
}) {
  const { t } = useLocale()
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-bronze">{title}</h2>
      <ul className="flex flex-col gap-3">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-xl border border-marble-3 bg-white p-3"
          >
            {item.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.name}
                width={56}
                height={56}
                className="h-14 w-14 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-lg bg-gradient-to-br from-ember-bright to-ember" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{item.name}</p>
              {item.description && (
                <p className="truncate text-xs text-bronze">{item.description}</p>
              )}
              <p className="font-mono text-xs text-bronze">
                {formatPrice(item.price_cents, currency)}
              </p>
              {item.dietary_tags.filter((tag) => enabledTags.includes(tag)).length > 0 && (
                <p className="text-xs text-bronze">
                  {item.dietary_tags
                    .filter((tag) => enabledTags.includes(tag))
                    .map((tag) => t(`dietary.${tag}`))
                    .join(' · ')}
                </p>
              )}
            </div>
            <AddItemButton
              qrToken={qrToken}
              menuItemId={item.id}
              recommendedItem={
                item.recommended_item_id ? (itemsById.get(item.recommended_item_id) ?? null) : null
              }
              currency={currency}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
