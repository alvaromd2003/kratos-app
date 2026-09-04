import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Uses the service_role key, which bypasses Row Level Security entirely.
// Only ever import this from Server Actions/Route Handlers that have
// already verified the caller's authorization themselves — this client
// has no RLS safety net.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
