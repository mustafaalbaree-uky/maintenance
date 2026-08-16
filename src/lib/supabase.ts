import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // The anon key is compiled into the bundle by design. That is safe only because RLS
  // is enabled on every table in the migration that creates it.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Copy .env.example to .env.local and fill both in.',
  )
}

// This project's Postgres is shared with another app that owns `public`. Every table
// here lives in the `maintenance` schema, so the client is pinned to it.
//
// `storageKey` matters more than it looks. Both apps are served from the same
// github.io origin and point at the same project, so supabase-js would default both to
// `sb-<ref>-auth-token`, one localStorage slot shared between two apps. Signing into one
// silently signed you into the other. This gives Maintenance its own slot.
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storageKey: 'maintenance-auth',
  },
  db: { schema: 'maintenance' },
})

/**
 * Local sign out only. The default revokes every refresh token the user holds, which on a
 * shared auth pool would sign them out of the other app too.
 */
export async function signOut() {
  await supabase.auth.signOut({ scope: 'local' })
}

export const RECEIPTS_BUCKET = 'maintenance-receipts'

export function receiptPath(userId: string, vehicleId: string, serviceLogId: string) {
  return `${userId}/${vehicleId}/${serviceLogId}.jpg`
}
