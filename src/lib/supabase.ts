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

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})

export const RECEIPTS_BUCKET = 'receipts'

export function receiptPath(userId: string, vehicleId: string, serviceLogId: string) {
  return `${userId}/${vehicleId}/${serviceLogId}.jpg`
}
