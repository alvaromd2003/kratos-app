'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { formatPrice, formatTime } from '@/lib/format'
import { DIETARY_TAGS, dietaryTagLabel } from '@/lib/dietary-tags'
import { requestCancelOrder } from '@/app/actions/ordering'
import { AddItemButton } from './add-item-button'
import { CartItemRow } from './cart-item-row'
import { SendOrderButton } from './send-order-button'
import { HelpButton } from './help-button'
import { PaymentPanel } from './payment-panel'
import { LoyaltyPanel } from './loyalty-panel'
import { ItemizedPaymentPanel } from './itemized-payment-panel'

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

const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  preparing: 'En preparación',
  ready: 'Lista para servir',
  delivered: 'Entregado',
}

function applyChange<T extends { id: string }>(
  current: T[],
  payload: RealtimePostgresChangesPayload<T>
): T[] {
  if (payload.eventType === 'INSERT') {
    const row = payload.new as T
    if (current.some((r) => r.id === row.id)) return current
    return [...current, row]
  }
  if (payload.eventType === 'UPDATE') {
    const row = payload.new as T
    return current.map((r) => (r.id === row.id ? row : r))
  }
  if (payload.eventType === 'DELETE') {
    const old = payload.old as Partial<T>
    return current.filter((r) => r.id !== old.id)
  }
  return current
}

export function LiveTable({
  qrToken,
  tableLabel,
  restaurantName,
  currency,
  enabledTags,
  restaurantId,
  tableSessionId,
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
  orderItemCoverage,
}: {
  qrToken: string
  tableLabel: string
  restaurantName: string
  currency: string
  enabledTags: string[]
  restaurantId: string
  tableSessionId: string
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
  const [participants, setParticipants] = useState(initialParticipants)
  const [orderItems, setOrderItems] = useState(initialOrderItems)
  const [orders, setOrders] = useState(initialOrders)
  const [restaurantActiveOrders, setRestaurantActiveOrders] = useState(
    initialRestaurantActiveOrders
  )
  const [paymentShares, setPaymentShares] = useState(initialPaymentShares)
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set())
  const hasConnectedBefore = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    async function resync() {
      const [
        { data: freshOrderItems },
        { data: freshParticipants },
        { data: freshOrders },
        { data: freshActive },
        { data: freshPaymentShares },
      ] = await Promise.all([
        supabase
          .from('order_items')
          .select('id, menu_item_id, participant_id, quantity, order_id, note')
          .eq('table_session_id', tableSessionId),
        supabase
          .from('session_participants')
          .select('id, name')
          .eq('table_session_id', tableSessionId),
        supabase
          .from('orders')
          .select('id, status, created_at, cancellation_requested_at')
          .eq('table_session_id', tableSessionId),
        supabase
          .from('orders')
          .select('id, status, created_at')
          .eq('restaurant_id', restaurantId)
          .in('status', ['pending', 'preparing']),
        supabase
          .from('payment_shares')
          .select('id, participant_id, mode, amount_cents, status')
          .eq('table_session_id', tableSessionId),
      ])
      if (freshOrderItems) setOrderItems(freshOrderItems)
      if (freshParticipants) setParticipants(freshParticipants)
      if (freshOrders) setOrders(freshOrders)
      if (freshActive) setRestaurantActiveOrders(freshActive)
      if (freshPaymentShares) setPaymentShares(freshPaymentShares)
    }

    const channel = supabase
      .channel(`table-session-${tableSessionId}`)
      .on<OrderItemRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'order_items',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setOrderItems((current) => applyChange(current, payload))
      )
      .on<Participant>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'session_participants',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setParticipants((current) => applyChange(current, payload))
      )
      .on<OrderRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setOrders((current) => applyChange(current, payload))
      )
      .on<PaymentShareRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_shares',
          filter: `table_session_id=eq.${tableSessionId}`,
        },
        (payload) => setPaymentShares((current) => applyChange(current, payload))
      )
      .subscribe((status) => {
        if (status !== 'SUBSCRIBED') return
        if (!hasConnectedBefore.current) {
          hasConnectedBefore.current = true
          return
        }
        // Reconnected after a drop (spotty wifi is common in a dining
        // room) — postgres_changes doesn't replay what was missed, so
        // pull a fresh snapshot instead of silently going stale.
        resync()
      })

    // Separate channel: every other table's orders, just enough to know
    // "how many are ahead of mine in the kitchen queue" — restaurant-wide,
    // not scoped to this table.
    const queueChannel = supabase
      .channel(`restaurant-queue-${restaurantId}`)
      .on<ActiveOrderRow>(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${restaurantId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<ActiveOrderRow>
            setRestaurantActiveOrders((current) => current.filter((o) => o.id !== old.id))
            return
          }
          const row = payload.new as ActiveOrderRow
          const isActive = row.status === 'pending' || row.status === 'preparing'
          setRestaurantActiveOrders((current) => {
            if (!isActive) return current.filter((o) => o.id !== row.id)
            if (current.some((o) => o.id === row.id)) {
              return current.map((o) => (o.id === row.id ? row : o))
            }
            return [...current, row]
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(queueChannel)
    }
  }, [tableSessionId, restaurantId])

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

  const lineTotal = (row: OrderItemRow) => {
    const item = itemsById.get(row.menu_item_id)
    return item ? item.price_cents * row.quantity : 0
  }
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
    if (id === participantId) return 'Tú'
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
      <div className="flex flex-col gap-3 rounded-2xl bg-gradient-to-b from-ink to-ink-2 px-5 py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-display text-white">{restaurantName}</h1>
          <p className="text-sm text-cream-dim">
            Mesa {tableLabel} · {participants.map((p) => participantLabel(p.id)).join(', ')}
          </p>
        </div>
        <p className="text-sm font-medium text-marble-2">
          Total de la mesa:{' '}
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
            <h2 className="font-display text-base text-ink">Tus pedidos</h2>
            {avgWaitMinutes !== null && (
              <span className="text-xs text-bronze">
                Tiempo medio de la cocina: ~<span className="font-mono">{avgWaitMinutes}</span> min
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
                          ({ahead > 0 ? `${ahead} por delante` : 'el siguiente'})
                        </span>
                      )}
                    </p>
                    {order.status === 'pending' &&
                      (order.cancellation_requested_at ? (
                        <span className="text-xs text-bronze">
                          Cancelación solicitada, esperando confirmación
                        </span>
                      ) : (
                        <form
                          action={requestCancelOrder}
                          onSubmit={(e) => {
                            if (
                              !confirm(
                                '¿Pedir a cocina que cancele este pedido? Si ya lo han empezado a preparar, pueden no aceptarlo.'
                              )
                            ) {
                              e.preventDefault()
                            }
                          }}
                        >
                          <input type="hidden" name="qr_token" value={qrToken} />
                          <input type="hidden" name="order_id" value={order.id} />
                          <button type="submit" className="text-xs text-rust underline">
                            Cancelar
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
            {tag.label}
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
            title="Otros"
            items={uncategorized}
            qrToken={qrToken}
            currency={currency}
            itemsById={itemsById}
            enabledTags={enabledTags}
          />
        )}
        {visibleItems.length === 0 && (
          <p className="text-sm text-gray-500">Ningún plato coincide con esos filtros.</p>
        )}
      </section>

      <section className="fixed inset-x-0 bottom-0 mx-auto flex max-h-64 w-full max-w-md flex-col gap-3 rounded-t-2xl border-t border-marble-3 bg-white px-5 py-4 text-ink shadow-[0_-8px_24px_rgba(11,25,44,0.1)]">
        <h2 className="font-display text-base text-ink">Carrito de la mesa</h2>
        {cartItems.length === 0 ? (
          <p className="text-sm text-bronze">Todavía no hay nada en el carrito.</p>
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
                  lineTotal={formatPrice(item.price_cents * row.quantity, currency)}
                />
              )
            })}
          </ul>
        )}
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-ink">
            Total del carrito:{' '}
            <span className="font-mono">{formatPrice(cartTotal, currency)}</span>
          </p>
          {cartItems.length > 0 && <SendOrderButton qrToken={qrToken} />}
        </div>
        <p className="text-center text-[0.68rem] tracking-wide text-bronze/70">
          Con la tecnología de Kratos Systems
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
              {item.dietary_tags.filter((t) => enabledTags.includes(t)).length > 0 && (
                <p className="text-xs text-bronze">
                  {item.dietary_tags
                    .filter((t) => enabledTags.includes(t))
                    .map(dietaryTagLabel)
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
