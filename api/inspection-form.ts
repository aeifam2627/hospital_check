import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { isoDate, shiftCode } from '../server/validation.js'
import { allowRequest, handleError, queryValue } from '../server/http.js'
import { getSupabaseAdmin } from '../server/supabase.js'

const querySchema = z.object({ type: z.string().regex(/^[a-z0-9-]{2,64}$/), date: isoDate, shift: shiftCode })

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowRequest(req, res, ['GET'])) return
  try {
    const query = querySchema.parse({ type: queryValue(req, 'type'), date: queryValue(req, 'date'), shift: queryValue(req, 'shift') })
    const { data, error } = await getSupabaseAdmin().rpc('get_inspection_form', { p_type_slug: query.type, p_work_date: query.date, p_shift_code: query.shift })
    if (error) throw error
    if (!data) return res.status(404).json({ error: 'ไม่พบแบบฟอร์มนี้หรือยังไม่เปิดใช้งาน' })
    return res.status(200).json({ data })
  } catch (error) { return handleError(error, res) }
}
