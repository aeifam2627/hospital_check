import { createHash } from 'node:crypto'
import type { VercelRequest,VercelResponse } from '@vercel/node'
import { getSupabaseAdmin } from './supabase.js'

export async function enforceRateLimit(req:VercelRequest,res:VercelResponse,scope:string,maxRequests:number,windowSeconds:number){
  const forwarded=req.headers['x-forwarded-for'];const ip=(Array.isArray(forwarded)?forwarded[0]:forwarded?.split(',')[0])?.trim()||req.socket.remoteAddress||'unknown'
  const digest=createHash('sha256').update(`${scope}:${ip}`).digest('hex').slice(0,32)
  const {data,error}=await getSupabaseAdmin().rpc('consume_api_rate_limit',{p_bucket_key:`${scope}:${digest}`,p_window_seconds:windowSeconds,p_max_requests:maxRequests})
  if(error)throw error
  if(!data){res.setHeader('Retry-After',String(windowSeconds));res.status(429).json({error:'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่'});return false}
  return true
}
