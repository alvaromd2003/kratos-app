import 'server-only'
import { headers } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

export type TableBillSummary = {
  totalCents: number
  paidCents: number
  remainingCents: number
  subtotalByParticipant: Map<string, number>
  paidIndividualByParticipant: Map<string, number>
}

// Every mode (individual/split/collective) just proposes a different
// amount to pay right now — none of them are tracked as a per-session
// setting. What matters is this shared balance: totalCents is every
// order_item ever added this sitting (sent or not, same as "Total de la
// mesa" in live-table.tsx), and any succeeded payment_share — regardless
// of which mode paid it — reduces what's left.
export async function getTableBillSummary(
  // Works with either the RLS-bound client (staff pages, which already
  // have SELECT access to these tables) or the service-role client (diner
  // actions, which have none) — both expose the same .from().select() shape.
  admin: SupabaseClient,
  tableSessionId: string
): Promise<TableBillSummary> {
  const [{ data: items }, { data: shares }] = await Promise.all([
    admin
      .from('order_items')
      .select('participant_id, quantity, menu_item_id')
      .eq('table_session_id', tableSessionId),
    admin
      .from('payment_shares')
      .select('participant_id, mode, amount_cents')
      .eq('table_session_id', tableSessionId)
      .eq('status', 'succeeded'),
  ])

  const itemList = items ?? []
  const menuItemIds = [...new Set(itemList.map((i) => i.menu_item_id))]
  const { data: menuItems } =
    menuItemIds.length > 0
      ? await admin.from('menu_items').select('id, price_cents').in('id', menuItemIds)
      : { data: [] }
  const priceById = new Map((menuItems ?? []).map((m) => [m.id, m.price_cents]))

  let totalCents = 0
  const subtotalByParticipant = new Map<string, number>()
  for (const item of itemList) {
    const lineTotal = (priceById.get(item.menu_item_id) ?? 0) * item.quantity
    totalCents += lineTotal
    subtotalByParticipant.set(
      item.participant_id,
      (subtotalByParticipant.get(item.participant_id) ?? 0) + lineTotal
    )
  }

  let paidCents = 0
  const paidIndividualByParticipant = new Map<string, number>()
  for (const share of shares ?? []) {
    paidCents += share.amount_cents
    if (share.mode === 'individual') {
      paidIndividualByParticipant.set(
        share.participant_id,
        (paidIndividualByParticipant.get(share.participant_id) ?? 0) + share.amount_cents
      )
    }
  }

  return {
    totalCents,
    paidCents,
    remainingCents: Math.max(0, totalCents - paidCents),
    subtotalByParticipant,
    paidIndividualByParticipant,
  }
}

export function individualAmountDue(summary: TableBillSummary, participantId: string): number {
  const subtotal = summary.subtotalByParticipant.get(participantId) ?? 0
  const alreadyPaid = summary.paidIndividualByParticipant.get(participantId) ?? 0
  return Math.max(0, Math.min(summary.remainingCents, subtotal - alreadyPaid))
}

export function splitAmountDue(summary: TableBillSummary, shareCount: number): number {
  if (summary.remainingCents <= 0 || shareCount < 1) return 0
  return Math.ceil(summary.remainingCents / shareCount)
}

// How many cents of each order_item have already been covered by
// SUCCEEDED itemized ('items' mode) payments — a dish can be split
// across several separate payments (each person's share of it), so this
// is a running total per item, not a plain claimed/unclaimed flag.
// Deliberately keyed off 'succeeded' only, never 'pending': that way an
// abandoned Stripe Checkout can never lock any part of a dish out of
// being picked again (see migration 0022's comment for the tradeoff).
export async function getOrderItemCoverage(
  admin: SupabaseClient,
  tableSessionId: string
): Promise<Map<string, number>> {
  const { data: shares } = await admin
    .from('payment_shares')
    .select('id')
    .eq('table_session_id', tableSessionId)
    .eq('status', 'succeeded')

  const shareIds = (shares ?? []).map((s) => s.id)
  const coverage = new Map<string, number>()
  if (shareIds.length === 0) return coverage

  const { data: claims } = await admin
    .from('payment_share_items')
    .select('order_item_id, amount_cents')
    .in('payment_share_id', shareIds)

  for (const claim of claims ?? []) {
    coverage.set(claim.order_item_id, (coverage.get(claim.order_item_id) ?? 0) + claim.amount_cents)
  }
  return coverage
}

// True the moment even a single cent of this line has been paid via the
// itemized mode — guards edits to one cart line, since an order_item
// with any coverage at all must never be quietly removed or have its
// quantity reduced, or that payment ends up covering less than it did.
export async function isOrderItemClaimed(
  admin: SupabaseClient,
  orderItemId: string
): Promise<boolean> {
  const { data: claims } = await admin
    .from('payment_share_items')
    .select('payment_share_id, amount_cents')
    .eq('order_item_id', orderItemId)
    .gt('amount_cents', 0)

  const shareIds = (claims ?? []).map((c) => c.payment_share_id)
  if (shareIds.length === 0) return false

  const { data: succeededShare } = await admin
    .from('payment_shares')
    .select('id')
    .in('id', shareIds)
    .eq('status', 'succeeded')
    .maybeSingle()

  return Boolean(succeededShare)
}

// Stripe needs an absolute success/cancel/return URL. Reading it off the
// request's own Host header (rather than a hardcoded/env site URL) means
// this works unmodified in local dev, previews, and production alike.
export async function getRequestOrigin(): Promise<string> {
  const store = await headers()
  const host = store.get('host') ?? 'localhost:3000'
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https'
  return `${protocol}://${host}`
}
