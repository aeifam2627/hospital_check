/* global process, console */
import { createClient } from '@supabase/supabase-js'

const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})
async function checked(query){const {data,error}=await query;if(error)throw error;return data}
const type=await checked(db.from('inspection_types').select('id').eq('slug','emergency-cart').single())
const specs=[
  {old:'สาย NG no.14/no.16',prefix:'สาย NG',labels:['No.14','No.16'],qty:5,shelf:'ชั้นที่ 4'},
  {old:'สาย ICD No.28/32',prefix:'สาย ICD',labels:['No.28','No.32'],qty:2,shelf:'ชั้นที่ 1'},
]
for(const spec of specs){
  const firstName=`${spec.prefix} ${spec.labels[0]}`
  const original=await checked(db.from('inspection_items').select('*').eq('inspection_type_id',type.id).eq('name',spec.old).maybeSingle())
    ??await checked(db.from('inspection_items').select('*').eq('inspection_type_id',type.id).eq('name',firstName).single())
  const originalVariants=await checked(db.from('inspection_variants').select('*').eq('item_id',original.id))
  // Keep variant IDs and standard history. Existing results retain their original snapshots.
  for(const [index,label] of spec.labels.entries()){
    const name=`${spec.prefix} ${label}`
    let target=index===0?original:await checked(db.from('inspection_items').select('*').eq('inspection_type_id',type.id).eq('name',name).maybeSingle())
    if(!target)target=await checked(db.from('inspection_items').insert({inspection_type_id:type.id,group_id:original.group_id,name,sort_order:original.sort_order,active_from:original.active_from,active_to:original.active_to}).select('*').single())
    const variant=originalVariants.find(value=>value.variant_label===label)
      ??await checked(db.from('inspection_variants').select('*').eq('item_id',target.id).is('variant_label',null).single())
    await checked(db.from('inspection_variants').update({item_id:target.id,variant_label:null,sort_order:1}).eq('id',variant.id))
    await checked(db.from('inspection_items').update({name}).eq('id',target.id))
  }
}
const form=await checked(db.rpc('get_inspection_form',{p_type_slug:'emergency-cart',p_work_date:'2026-11-10',p_shift_code:'morning'}))
for(const spec of specs){
  const group=form.groups.find(value=>value.name===spec.shelf)
  for(const label of spec.labels){
    const name=`${spec.prefix} ${label}`,item=group?.items.find(value=>value.name===name)
    if(!item||item.variants.length!==1||item.variants[0].variant_label!==null||item.variants[0].standard_qty!==spec.qty||item.variants[0].unit!=='เส้น')throw new Error(`Verification failed: ${name}`)
    console.log(JSON.stringify({shelf:group.name,item:name,standard_qty:item.variants[0].standard_qty,unit:item.variants[0].unit}))
  }
  if(form.groups.some(group=>group.items.some(item=>item.name===spec.old)))throw new Error(`Combined item still visible: ${spec.old}`)
}
