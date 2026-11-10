import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isoDate } from '../server/validation.js'
import { allowRequest, handleError, queryValue } from '../server/http.js'
import { getSupabaseAdmin } from '../server/supabase.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!allowRequest(req,res,['GET'])) return
  try {
    const date=isoDate.parse(queryValue(req,'date'))
    const {data,error}=await getSupabaseAdmin().rpc('get_dashboard',{p_work_date:date})
    if(error) throw error
    return res.status(200).json({data})
  } catch(error){ return handleError(error,res) }
}
