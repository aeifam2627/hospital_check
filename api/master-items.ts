import type { VercelRequest, VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { allowRequest, handleError } from '../server/http.js'
import { enforceRateLimit } from '../server/rate-limit.js'
import { getSupabaseAdmin } from '../server/supabase.js'
import { isoDate } from '../server/validation.js'

const itemSchema=z.object({
  type_slug:z.string().regex(/^[a-z0-9-]{2,64}$/),
  name:z.string().trim().min(2).max(160),
  variant_label:z.string().trim().max(80).default(''),
  unit:z.string().trim().min(1).max(40),
  standard_qty:z.number().int().min(0).max(99999),
  effective_from:isoDate,
  group_name:z.string().trim().max(100).default(''),
}).strict()

export default async function handler(req:VercelRequest,res:VercelResponse){
  if(!allowRequest(req,res,['POST']))return
  try{
    if(!await enforceRateLimit(req,res,'master-items',12,300))return
    const input=itemSchema.parse(req.body),db=getSupabaseAdmin()
    const {data:type,error:typeError}=await db.from('inspection_types').select('id').eq('slug',input.type_slug).eq('is_active',true).single()
    if(typeError||!type)throw typeError??new Error('ไม่พบประเภทแบบตรวจ')
    const {data:duplicate,error:duplicateError}=await db.from('inspection_items').select('id').eq('inspection_type_id',type.id).ilike('name',input.name).is('active_to',null).maybeSingle()
    if(duplicateError)throw duplicateError
    if(duplicate)return res.status(409).json({error:'มีรายการชื่อนี้อยู่แล้ว กรุณาตรวจชื่อหรือแก้รายการเดิม'})
    let groupId:string|null=null
    if(input.group_name){
      const {data:existing}=await db.from('inspection_groups').select('id').eq('inspection_type_id',type.id).eq('name',input.group_name).maybeSingle()
      if(existing)groupId=existing.id
      else{const {data:created,error}=await db.from('inspection_groups').insert({inspection_type_id:type.id,name:input.group_name,sort_order:99}).select('id').single();if(error)throw error;groupId=created.id}
    }
    const {data:last}=await db.from('inspection_items').select('sort_order').eq('inspection_type_id',type.id).order('sort_order',{ascending:false}).limit(1).maybeSingle()
    const {data:item,error:itemError}=await db.from('inspection_items').insert({inspection_type_id:type.id,group_id:groupId,name:input.name,sort_order:(last?.sort_order??0)+1,active_from:input.effective_from}).select('id,name').single()
    if(itemError)throw itemError
    try{
      const {data:variant,error:variantError}=await db.from('inspection_variants').insert({item_id:item.id,variant_label:input.variant_label||null,unit:input.unit,sort_order:1,active_from:input.effective_from}).select('id').single()
      if(variantError)throw variantError
      const {error:standardError}=await db.from('variant_standards').insert({variant_id:variant.id,standard_qty:input.standard_qty,effective_from:input.effective_from})
      if(standardError)throw standardError
    }catch(error){await db.from('inspection_variants').delete().eq('item_id',item.id);await db.from('inspection_items').delete().eq('id',item.id);throw error}
    return res.status(201).json({data:item})
  }catch(error){return handleError(error,res)}
}
