import { createClient } from '@supabase/supabase-js'

export function getSupabaseAdmin() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Server is missing SUPABASE_URL or SUPABASE_SECRET_KEY')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
