/* global process, console, URL */
import { createClient } from '@supabase/supabase-js'

const url=process.env.SUPABASE_URL
const key=process.env.SUPABASE_SECRET_KEY
if(!url||!key)throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY')

const db=createClient(url,key,{auth:{persistSession:false}})
const tables=['inspection_types','inspection_groups','inspection_items','inspection_variants','variant_standards','inspection_submissions','inspection_results','import_batches']
const counts={}
for(const table of tables){
  const {count,error}=await db.from(table).select('*',{count:'exact',head:true})
  counts[table]=error?{error:error.code??error.message}:count
}
const {data:types,error}=await db.from('inspection_types').select('slug,title_th').order('slug')
const {data:submissions,error:submissionError}=await db.from('inspection_submissions').select('source,import_status')
const submissionSummary=submissionError?{error:submissionError.code??submissionError.message}:(submissions??[]).reduce((summary,row)=>{
  const label=`${row.source}:${row.import_status}`
  summary[label]=(summary[label]??0)+1
  return summary
},{})
const {data:form,error:formError}=await db.rpc('get_inspection_form',{p_type_slug:'medication',p_work_date:'2026-11-01',p_shift_code:'morning'})
const formCheck=formError?{error:formError.code??formError.message}:{loaded:Boolean(form),groups:form?.groups?.length??0,items:form?.groups?.reduce((count,group)=>count+(group.items?.length??0),0)??0}
console.log(JSON.stringify({host:new URL(url).host,counts,types:error?{error:error.code??error.message}:types,submission_summary:submissionSummary,form_check:formCheck},null,2))
