'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getCurrentRestaurant } from '@/lib/restaurant'
import { TABLE_ZONES, type TableZone } from '@/lib/table-zones'
import { TABLE_SHAPES, type TableShape } from '@/lib/table-shapes'

export type TableFormState = { errorCode?: string } | undefined

function readZone(formData: FormData): TableZone | null {
  const raw = String(formData.get('zone') ?? '')
  return (TABLE_ZONES as readonly string[]).includes(raw) ? (raw as TableZone) : null
}

function readShape(formData: FormData): TableShape {
  const raw = String(formData.get('shape') ?? '')
  return (TABLE_SHAPES as readonly string[]).includes(raw) ? (raw as TableShape) : 'round'
}

export async function createTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const label = String(formData.get('label') ?? '').trim()

  if (!label) {
    return { errorCode: 'EMPTY_TABLE_LABEL' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tables')
    .insert({ restaurant_id: restaurant.id, label, zone: readZone(formData), shape: readShape(formData) })

  if (error) {
    return { errorCode: 'COULD_NOT_CREATE_TABLE' }
  }

  revalidatePath('/admin/tables')
  revalidatePath('/admin/floor')
}

export async function updateTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const label = String(formData.get('label') ?? '').trim()

  if (!label) {
    return { errorCode: 'EMPTY_TABLE_LABEL' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('tables')
    .update({ label, zone: readZone(formData), shape: readShape(formData) })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { errorCode: 'COULD_NOT_UPDATE_TABLE' }
  }

  revalidatePath('/admin/tables')
  revalidatePath('/admin/floor')
}

export async function deleteTable(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()

  // Deleting cascades to every session/order this table ever had (that's
  // how the schema is set up) — block it once there's real history so a
  // rename-by-delete-and-recreate doesn't silently wipe the record.
  const { count } = await supabase
    .from('table_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('table_id', id)
    .eq('restaurant_id', restaurant.id)

  if ((count ?? 0) > 0) {
    return { errorCode: 'TABLE_HAS_HISTORY' }
  }

  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { errorCode: 'COULD_NOT_DELETE_TABLE' }
  }

  revalidatePath('/admin/tables')
  revalidatePath('/admin/floor')
}

// Called directly from client code on drop (not a <form> submit), so it
// takes plain arguments instead of FormData. Position is a 0-100 percent
// of the floor-plan canvas rather than pixels, so it stays correct
// however wide the screen viewing it is.
export async function updateTablePosition(id: string, posX: number, posY: number) {
  const { restaurant } = await getCurrentRestaurant()
  const supabase = await createClient()

  await supabase
    .from('tables')
    .update({ pos_x: posX, pos_y: posY })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/floor')
}

export async function toggleTableActive(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')

  const supabase = await createClient()

  // Reads the current value itself instead of trusting a hidden input
  // (stale if another staff member already toggled it elsewhere) — that
  // could otherwise flip it right back.
  const { data: current } = await supabase
    .from('tables')
    .select('active')
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!current) return

  await supabase
    .from('tables')
    .update({ active: !current.active })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  revalidatePath('/admin/tables')
  revalidatePath('/admin/floor')
}

// Ends the group currently seated at this table so the next QR scan starts
// a brand-new session instead of joining the outgoing group's. Any staff
// member can do this — in practice it's whoever's on the floor who knows
// when a group has actually left, not just the owner.
export async function closeTableSession(formData: FormData) {
  const { restaurant } = await getCurrentRestaurant()
  const tableId = String(formData.get('table_id') ?? '')

  const supabase = await createClient()

  const { data: table } = await supabase
    .from('tables')
    .select('id')
    .eq('id', tableId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle()
  if (!table) return

  const { data: session } = await supabase
    .from('table_sessions')
    .select('id')
    .eq('table_id', table.id)
    .eq('status', 'open')
    .maybeSingle()
  if (!session) return

  // Closing used to unconditionally flip the session, regardless of any
  // order still mid-preparation — every staff board filters orders down
  // to open sessions only (so closed tables stop cluttering it once
  // they're truly done), so an order left over from an early close
  // became permanently invisible to staff, not just to the diner.
  // Refusing to close while one is still active keeps that order visible
  // until it's actually finished, matching the existing pending-balance
  // guard's spirit (surfaced client-side via its own confirm dialog).
  const { count: activeOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('table_session_id', session.id)
    .in('status', ['pending', 'preparing', 'ready'])
  if ((activeOrderCount ?? 0) > 0) return

  await supabase
    .from('table_sessions')
    .update({ status: 'closed', closed_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('status', 'open')

  revalidatePath('/admin/tables')
  revalidatePath('/admin/floor')
  revalidatePath('/admin/kitchen')
}

// Invalidates the old printed QR (if one exists) by swapping the token the
// diner-facing URL is keyed on — same random-UUID generation Postgres's own
// column default would have used at table creation, just triggered by hand.
export async function regenerateTableQr(
  _prevState: TableFormState,
  formData: FormData
): Promise<TableFormState> {
  const { restaurant } = await getCurrentRestaurant()
  const id = String(formData.get('id') ?? '')
  const force = formData.get('force') === 'true'

  const supabase = await createClient()

  // The diner's whole session is keyed off the qr_token in the URL — the
  // moment it changes, anyone with that table's page already open gets
  // disconnected from their live cart/bill (a 404 on reload, and every
  // further action failing). Confirming this is safe (checkbox/dialog on
  // the client) isn't real access control, so re-check it here too: refuse
  // a silent regeneration while a diner could actually be mid-session,
  // unless staff explicitly says to do it anyway.
  if (!force) {
    const { data: openSession } = await supabase
      .from('table_sessions')
      .select('id')
      .eq('table_id', id)
      .eq('restaurant_id', restaurant.id)
      .eq('status', 'open')
      .maybeSingle()
    if (openSession) {
      return { errorCode: 'TABLE_HAS_ACTIVE_SESSION' }
    }
  }

  const { error } = await supabase
    .from('tables')
    .update({ qr_token: randomUUID() })
    .eq('id', id)
    .eq('restaurant_id', restaurant.id)

  if (error) {
    return { errorCode: 'COULD_NOT_REGENERATE_QR' }
  }

  revalidatePath('/admin/tables')
}
