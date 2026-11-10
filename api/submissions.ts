import type { VercelRequest, VercelResponse } from '@vercel/node'
import { allowRequest, handleError } from '../server/http.js'
import { getSupabaseAdmin } from '../server/supabase.js'
import { submissionSchema } from '../server/validation.js'
import { enforceRateLimit } from '../server/rate-limit.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowRequest(req, res, ['POST'])) return
  try {
    if(!await enforceRateLimit(req,res,'submissions',30,300))return
    const body = submissionSchema.parse(req.body)
    const { data, error } = await getSupabaseAdmin().rpc('save_inspection_submission', { p_payload: body })
    if (error) throw error
    return res.status(200).json({ data })
  } catch (error) { return handleError(error, res) }
}
