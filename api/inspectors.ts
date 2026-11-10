import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowRequest, handleError } from '../server/http.js'
import { getSupabaseAdmin } from '../server/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowRequest(req, res, ['GET'])) return
  try {
    const { data, error } = await getSupabaseAdmin().from('inspectors').select('id,display_name').eq('is_active', true).order('sort_order')
    if (error) throw error
    return res.status(200).json({ data })
  } catch (error) { return handleError(error, res) }
}
