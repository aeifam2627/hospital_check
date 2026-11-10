import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { isoDate } from '../server/validation.js'
import { allowRequest, handleError, queryValue } from '../server/http.js'
import { getSupabaseAdmin } from '../server/supabase.js'

const schema=z.object({from:isoDate,to:isoDate,type:z.string().max(64).optional().transform(v=>v||null),page:z.coerce.number().int().min(1).default(1),limit:z.coerce.number().int().min(1).max(50).default(20)}).refine(value=>value.from<=value.to,{message:'วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด',path:['from']})
export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!allowRequest(req,res,['GET'])) return
  try{
    const q=schema.parse({from:queryValue(req,'from'),to:queryValue(req,'to'),type:queryValue(req,'type'),page:queryValue(req,'page'),limit:queryValue(req,'limit')})
    const {data,error}=await getSupabaseAdmin().rpc('get_inspection_history',{p_from:q.from,p_to:q.to,p_type_slug:q.type,p_limit:q.limit,p_offset:(q.page-1)*q.limit})
    if(error) throw error
    return res.status(200).json({data})
  }catch(error){return handleError(error,res)}
}
