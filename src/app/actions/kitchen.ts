'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { awardLoyaltyStampsIfFullyPaid, restoreLoyaltyStamps } from '@/lib/loyalty'
import { getTableBillSummary } from '@/lib/payments'
import { getOrCreateStaffParticipant } from '@/lib/ordering'

const ORDER_STATUSES = ['pending', 'preparing', 'ready', 'delivered'] as const

// Kitchen only moves food through prep; waiter only hands it off once it's
// ready. Owner/admin can do either — useful if someone's filling in.
const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  kitchen_staff: ['preparing', 'ready'],
  waiter: ['delivered'],
}

export async function updateOrderStatus(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()

  const id = String(formData.get('id') ?? '')
  const status = String(formData.get('status') ?? '')
  if (!ORDER_STATUSES.includes(status as (typeof ORDER_STATUSES)[number])) return

  if (role !== 'owner' && role !== 'admin' && !ALLOWED_TRANSITIONS[role]?.includes(status)) {
    return
  }

  const supabase = await createClient()
  await supabase
    .from('orders')
    .update({ status, ...(status === 'ready' ? { ready_at: new Date().toISOString() } : {}) })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/kitchen')
  revalidatePath('/admin/floor')
}

export async function resolveHelpRequest(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase
    .from('help_requests')
    .update({ status: 'resolved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/floor')
}

// Only while an order is still "pending" (kitchen hasn't started on it) —
// puts its items back in the diner's open cart instead of just discarding
// them, so they can fix a mistake and resend.
export async function cancelOrderAsStaff(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'kitchen_staff') return

  const id = String(formData.get('id') ?? '')

  const admin = createAdminClient()

  const { data: order } = await admin
    .from('orders')
    .select('id, status, cancellation_requested_at')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!order || order.status !== 'pending' || !order.cancellation_requested_at) return

  // Atomically consumes the SAME request we just read: if a staff member
  // on another device already hit "Rechazar" in between, the flag has
  // since changed (cleared) and this update matches zero rows — the
  // order is left alone instead of being cancelled anyway on top of an
  // explicit staff decision to keep it.
  const { data: consumed } = await admin
    .from('orders')
    .update({ cancellation_requested_at: null })
    .eq('id', id)
    .eq('status', 'pending')
    .eq('cancellation_requested_at', order.cancellation_requested_at)
    .select('id')
    .maybeSingle()
  if (!consumed) return

  await admin.from('order_items').update({ order_id: null }).eq('order_id', id)
  await admin.from('orders').delete().eq('id', id)

  revalidatePath('/admin/kitchen')
}

// The diner asked to cancel; kitchen decides no (they've already started,
// or it's too far along) — clears the flag, order carries on as normal.
export async function rejectCancelOrder(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'kitchen_staff') return

  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  await supabase
    .from('orders')
    .update({ cancellation_requested_at: null })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .not('cancellation_requested_at', 'is', null)

  revalidatePath('/admin/kitchen')
}

// Staff physically received the cash — only now does it count toward the
// table's paid balance. Re-checked against the current balance first: the
// rest of this same bill could have been settled another way (card,
// itemized) while this request sat waiting for staff to physically
// receive the money, and confirming it anyway would overcount.
export async function confirmCashPayment(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') return

  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()
  const admin = createAdminClient()

  const { data: pending } = await supabase
    .from('payment_shares')
    .select('table_session_id, amount_cents')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .eq('mode', 'cash')
    .eq('status', 'pending')
    .maybeSingle()
  if (!pending) return

  const summary = await getTableBillSummary(admin, pending.table_session_id)
  if (pending.amount_cents > summary.remainingCents) return

  const { data: updated } = await supabase
    .from('payment_shares')
    .update({ status: 'succeeded', completed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .eq('mode', 'cash')
    .eq('status', 'pending')
    .select('table_session_id')
    .maybeSingle()

  // loyalty_accounts has no RLS policies (service-role only, see
  // migration 0020) — the staff-scoped client above can't touch it. No
  // stamp-spending here anymore — getParticipantLoyaltyDiscount already
  // reserved (spent) the stamps up front when the cash request was made.
  if (updated) {
    await awardLoyaltyStampsIfFullyPaid(admin, updated.table_session_id, restaurant.id)
  }

  revalidatePath('/admin/floor')
}

// Staff decline the cash request (e.g. the diner pays by card instead) —
// the request just disappears, nothing was ever counted as paid. Any
// loyalty stamps that request reserved up front must be given back, or
// they'd be spent for nothing.
export async function rejectCashPayment(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') return

  const id = String(formData.get('id') ?? '')

  const admin = createAdminClient()
  await restoreLoyaltyStamps(admin, id)

  const supabase = await createClient()
  await supabase
    .from('payment_shares')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .eq('mode', 'cash')
    .eq('status', 'pending')

  revalidatePath('/admin/floor')
}

// Covers the case with no diner-side counterpart at all: a table that used
// only "Pedido asistido" (nobody ever scanned the QR) has no participant
// who could press "Avisar al personal", so there was previously no way to
// record that money was actually collected — only to close the table and
// silently write the balance off. Staff already have the money in hand
// (cash or their own card terminal) by the time they'd press this, so it's
// recorded as succeeded immediately rather than going through the
// request/confirm two-step used for a diner's own cash request.
export async function recordManualPayment(formData: FormData) {
  const { restaurant, role } = await getCurrentRestaurant()
  if (role !== 'owner' && role !== 'admin' && role !== 'waiter') return

  const tableId = String(formData.get('table_id') ?? '')

  const supabase = await createClient()
  const { data: session } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('table_id', tableId)
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'open')
    .maybeSingle()
  if (!session) return

  const admin = createAdminClient()
  const summary = await getTableBillSummary(admin, session.id)
  if (summary.remainingCents <= 0) return

  const participantId = await getOrCreateStaffParticipant(admin, session.id)
  if (!participantId) return

  const { error } = await admin.from('payment_shares').insert({
    restaurant_id: restaurant.id,
    table_session_id: session.id,
    participant_id: participantId,
    mode: 'cash',
    amount_cents: summary.remainingCents,
    charged_cents: summary.remainingCents,
    status: 'succeeded',
    completed_at: new Date().toISOString(),
  })

  if (!error) {
    await awardLoyaltyStampsIfFullyPaid(admin, session.id, restaurant.id)
  }

  revalidatePath('/admin/floor')
  revalidatePath('/admin/tables')
}
