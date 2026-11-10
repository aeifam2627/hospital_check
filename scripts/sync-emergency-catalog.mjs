/* global process, console */
import ExcelJS from 'exceljs'
import { readFile,writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

// Only the named inventory area and standard column are read; daily results are never imported here.
const book=new ExcelJS.Workbook()
await book.xlsx.load(await readFile('private/legacy-excel/ตาราง OK รถ Emergency.xlsx'))
const aliases={'Carifix Stretch1':'Carifix Stretch','เครื่อง Othamoscope':'เครื่อง Othamoscope/otoscope','เครื่อง otoscope':'เครื่อง Othamoscope/otoscope','สาย ICD No.28,32':'สาย ICD No.28/32'}
const splits={'สาย suction No.14/16':['No.14','No.16'],'สาย ICD No.28/32':['No.28','No.32'],'กรรไกร,ไฟฉาย':['กรรไกร','ไฟฉาย'],'เอี่ยม/แว่นตา':['เอี่ยม','แว่นตา']}
const inventory=new Map(),pending=[]
for(const sheet of book.worksheets){
  let group=''
  for(let row=2;row<=41;row++){
    const a=String(sheet.getCell(row,1).value??'').trim(),b=String(sheet.getCell(row,2).value??'').trim(),standard=sheet.getCell(row,3).value
    if(/^ชั้น(?:บน|ที่\s*[1-4])$/.test(a))group=a
    if(!group||!b||standard==null)continue
    const name=aliases[b]??b
    // Owner confirmed shelf and quantities in chat: No.14 = 5, No.16 = 5.
    // This overrides only the standard column, never historical inspection results.
    if(name==='สาย NG no.14/no.16'){
      for(const label of ['No.14','No.16'])inventory.set(`สาย NG ${label}`,{name:`สาย NG ${label}`,group:'ชั้นที่ 4',sort_order:row,unit:'เส้น',quantities:[5],labels:[null],confirmation:'Owner confirmed separate items, each at 5 เส้น'})
      continue
    }
    if(standard instanceof Date){if(!pending.some(item=>item.name===name))pending.push({name,group,cell:sheet.getCell(row,3).address,reason:'Excel date in standard quantity; requires confirmation'});continue}
    const match=String(standard).trim().match(/^(\d+(?:\s*,\s*\d+)*)\s*(.*)$/)
    if(!match)throw new Error(`Unrecognized standard ${sheet.name}:${row}`)
    const quantities=match[1].split(',').map(Number),labels=splits[name]??[null]
    if(labels.length!==quantities.length)throw new Error(`Unmatched variants: ${name}`)
    if(name==='สาย ICD No.28/32'){
      for(const [index,label] of labels.entries())inventory.set(`สาย ICD ${label}`,{name:`สาย ICD ${label}`,group,sort_order:row,unit:'เส้น',quantities:[quantities[index]],labels:[null]})
      continue
    }
    if(!inventory.has(name))inventory.set(name,{name,group,sort_order:row,unit:match[2].trim()||'หน่วย',quantities,labels})
  }
}
const manifest={groups:['ชั้นบน','ชั้นที่ 1','ชั้นที่ 2','ชั้นที่ 3','ชั้นที่ 4'],items:[...inventory.values()],pending}
await writeFile('private/legacy-excel/emergency-catalog-report.json',JSON.stringify(manifest,null,2))
if(!process.argv.includes('--commit')){console.log(JSON.stringify({items:inventory.size,groups:manifest.groups,pending},null,2));process.exit(0)}
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}})
async function checked(query){const {data,error}=await query;if(error)throw error;return data}
const type=await checked(db.from('inspection_types').select('id').eq('slug','emergency-cart').single())
const effective='2026-11-10',previous='2026-11-09'
const ngOnly=process.argv.includes('--ng-only')
if(!ngOnly)for(const [index,group] of manifest.groups.entries())await checked(db.from('inspection_groups').upsert({inspection_type_id:type.id,name:group,sort_order:index+1},{onConflict:'inspection_type_id,name'}))
const groups=await checked(db.from('inspection_groups').select('id,name').eq('inspection_type_id',type.id))
let added=0
for(const entry of inventory.values()){
  if(ngOnly&&!['สาย NG No.14','สาย NG No.16'].includes(entry.name))continue
  let item=await checked(db.from('inspection_items').select('id').eq('inspection_type_id',type.id).eq('name',entry.name).maybeSingle())
  const groupId=groups.find(group=>group.name===entry.group).id
  if(!item){item=await checked(db.from('inspection_items').insert({inspection_type_id:type.id,name:entry.name,group_id:groupId,sort_order:entry.sort_order,active_from:effective}).select('id').single());added++}
  else await checked(db.from('inspection_items').update({group_id:groupId,sort_order:entry.sort_order}).eq('id',item.id))
  // The initial seed mistakenly modeled boxed gloves as adult/child pairs. Retain old variants for history.
  if(entry.name==='ถุงมือ')await checked(db.from('inspection_variants').update({active_to:previous}).eq('item_id',item.id).not('variant_label','is',null).is('active_to',null))
  for(const [index,label] of entry.labels.entries()){
    let query=db.from('inspection_variants').select('id').eq('item_id',item.id).is('active_to',null)
    query=label===null?query.is('variant_label',null):query.eq('variant_label',label)
    let variant=await checked(query.maybeSingle())
    if(!variant)variant=await checked(db.from('inspection_variants').insert({item_id:item.id,variant_label:label,unit:entry.unit,sort_order:index+1,active_from:effective}).select('id').single())
    // Preserve already configured units and historical standards; new standards start on the cutover date.
    await checked(db.from('variant_standards').upsert({variant_id:variant.id,standard_qty:entry.quantities[index],effective_from:effective},{onConflict:'variant_id,effective_from'}))
  }
}
console.log(JSON.stringify({added,total_items:inventory.size,groups:manifest.groups,pending,effective_from:effective},null,2))
if(ngOnly){
  const form=await checked(db.rpc('get_inspection_form',{p_type_slug:'emergency-cart',p_work_date:effective,p_shift_code:'morning'}))
  const shelf=form.groups.find(group=>group.name==='ชั้นที่ 4')
  const ng=shelf?.items.filter(item=>['สาย NG No.14','สาย NG No.16'].includes(item.name))
  if(ng?.length!==2||!ng.every(item=>item.variants.length===1&&item.variants[0].variant_label===null&&item.variants[0].standard_qty===5&&item.variants[0].unit==='เส้น'))throw new Error('NG form verification failed')
  console.log(JSON.stringify({verified:true,shelf:shelf.name,items:ng.map(item=>item.name)},null,2))
}
