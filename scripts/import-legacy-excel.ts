import { createHash } from 'node:crypto'
import { readFile,writeFile } from 'node:fs/promises'
import { basename,resolve } from 'node:path'
import ExcelJS from 'exceljs'
import { createClient } from '@supabase/supabase-js'
import { inferLegacyType,parseWorkbook,type LegacyType,type MasterItem } from './legacy-import-core.ts'

const args=process.argv.slice(2)
const value=(name:string)=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined}
const commit=args.includes('--commit'),dryRun=args.includes('--dry-run')||!commit,fileArg=value('--file'),outArg=value('--out')
if(!fileArg||commit&&dryRun){console.error('Usage: npm run import:legacy -- --file <xlsx> [--type medication|emergency-cart|medical-equipment] (--dry-run|--commit) [--out report.json]');process.exit(2)}

const file=resolve(fileArg),bytes=await readFile(file),checksum=createHash('sha256').update(bytes).digest('hex'),sourceFile=basename(file)
if(bytes.byteLength>50*1024*1024){console.error('ไฟล์ใหญ่เกิน 50 MB กรุณาตรวจสอบหรือแบ่งไฟล์ก่อน import');process.exit(2)}
const requested=value('--type') as LegacyType|undefined,type=requested??inferLegacyType(sourceFile)
if(!type){console.error('ระบุ --type เพราะไม่สามารถอนุมานประเภทจากชื่อไฟล์');process.exit(2)}
const validTypes=new Set(['medication','emergency-cart','medical-equipment']);if(!validTypes.has(type)){console.error('Invalid --type');process.exit(2)}
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_SECRET_KEY,db:any=url&&key?createClient(url,key,{auth:{persistSession:false}}):null
if(commit&&!db){console.error('--commit ต้องมี SUPABASE_URL และ SUPABASE_SECRET_KEY');process.exit(2)}
const master=db?await loadMaster(db,type):fallbackMaster(type)
if(!master.length){console.error(`ไม่พบ master data สำหรับ ${type}`);process.exit(2)}

const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(bytes as unknown as ExcelJS.Buffer)
const report=parseWorkbook(workbook,sourceFile,type,master,checksum)
const safeReport={...report,slots:report.slots.map(({evidence:_evidence,...slot})=>slot),samples:report.samples.map(({evidence:_evidence,...slot})=>slot),evidence:report.evidence.slice(0,5000)}
const out=resolve(outArg??`${file}.import-report.json`);await writeFile(out,JSON.stringify(safeReport,null,2),'utf8')

let batchId:string|undefined
if(db){const status=commit?'committed':'dry_run';const batch=await db.from('import_batches').upsert({source_file:sourceFile,status,source_checksum:checksum,row_count:report.parsed_slots,warnings:report.evidence.filter(e=>e.parse_status==='ambiguous').slice(0,500),report:{worksheets:report.worksheets,parsed_slots:report.parsed_slots,converted_cells:report.converted_cells,ambiguous_cells:report.ambiguous_cells,blank_dates:report.blank_dates,warnings:report.warnings}},{onConflict:'source_checksum'}).select('id').single();if(batch.error)throw batch.error;batchId=batch.data.id
  for(let offset=0;offset<report.evidence.length;offset+=500){const rows=report.evidence.slice(offset,offset+500).map(e=>({batch_id:batchId,...e}));const saved=await db.from('import_row_evidence').upsert(rows,{onConflict:'batch_id,sheet_name,source_cell'});if(saved.error)throw saved.error}}

const results:Array<{key:string;status:string}>=[]
if(commit&&db){if(master.some(item=>item.variants.some(variant=>variant.id.startsWith('local:'))))throw new Error('Commit refused: master data does not contain Supabase UUIDs')
  for(const slot of report.slots){if(slot.evidence.some(e=>e.parse_status==='ambiguous')){results.push({key:slot.legacy_source_key,status:'skipped_ambiguous'});continue}const {data,error}=await db.rpc('import_legacy_submission',{p_payload:{type_slug:slot.type_slug,work_date:slot.work_date,shift_code:slot.shift_code,inspector_name:slot.inspector_name,import_status:slot.import_status,legacy_source_key:slot.legacy_source_key,results:slot.results}});if(error)throw error;results.push({key:slot.legacy_source_key,status:String(data.status)})}
  const partial=results.some(r=>!['imported','already_imported'].includes(r.status));const updated=await db.from('import_batches').update({status:partial?'partial':'committed',report:{...safeReport,commit_results:results}}).eq('id',batchId!);if(updated.error)throw updated.error}

console.log(JSON.stringify({mode:commit?'commit':'dry-run',source:sourceFile,type,checksum,report:out,worksheets:report.worksheets,slots:report.parsed_slots,converted_cells:report.converted_cells,ambiguous_cells:report.ambiguous_cells,blank_dates:report.blank_dates.length,commit_results:results.reduce<Record<string,number>>((acc,item)=>(acc[item.status]=(acc[item.status]??0)+1,acc),{})},null,2))

async function loadMaster(client:any,slug:LegacyType):Promise<MasterItem[]>{const {data,error}=await client.from('inspection_items').select('id,name,inspection_types!inner(slug),inspection_variants(id,variant_label,unit,sort_order)').eq('inspection_types.slug',slug).order('sort_order').order('sort_order',{referencedTable:'inspection_variants'});if(error)throw error;return (data??[] as any[]).map((item:any)=>({id:item.id,name:item.name,aliases:[],variants:(item.inspection_variants??[]).map((variant:any)=>({id:variant.id,label:variant.variant_label,unit:variant.unit}))}))}

function fallbackMaster(slug:LegacyType):MasterItem[]{
  const medication=['Morphine (ยาเสพติด)','Pethidine (ยาเสพติด)','Dormicum (ยาเสพติด)','Fentanyl (ยาเสพติด)','Ventolin NB (ยาพ่น)','Levophed 4 mg','7.5%NaHCo3','10%calcium gluconate','Dopamine 500 mg','Adrenaline 1 mg','Diazepam 10 mg','Dexamethazone 4 mg','CPM 10 mg','Holoperidol 5 mg','50%glucose 50 ml','ASA 300 mg','Amlodipine 10 mg','Captopril 25 mg','Clopidogrel 75 mg','Hydralazine 25 mg','Isordil 5 mg','HN(70/30) 10 ml (ตู้เย็น)','NPH 10 ml (ตู้เย็น)','RI 10 ml (ตู้เย็น)','กระเป๋า CPR']
  const equipment:[string,string[]][]=[['เครื่อง Defrib',[]],['เครื่อง EKG',[]],['เครื่อง NIBP Monitor',[]],['Infusion pump 1 ทาง',[]],['Infusion pump Body grad',[]],['เครื่องอุ่นเลือด',[]],['เครื่อง O2 Sat',[]],['เครื่องตรวจ Urin space',[]],['เครื่องตรวจ DTX',[]],['เครื่อง Suction mobile',[]],['BP ตั้งโต๊ะผู้ใหญ่/เด็ก',['ผู้ใหญ่','เด็ก']],['ปรอทวัดไข้ดิจิตอล',[]],['Peak Flow',[]],['กรรไกรตัดไหม/ตัดเนื้อ',['ตัดไหม','ตัดเนื้อ']],['Atery โค้ง/ตรง',['โค้ง','ตรง']],['เข็ม Biosy (1 ชุดมี 3 ชิ้น)',[]],['เข็มเจาะปอด',[]],['ด้ามมีด',[]],['HFNC',[]],['Stethoscope',[]],['สายเครื่องช่วยหายใจ',[]]]
  const emergency:[string,string[]][]=[['สาย suction No.14/16',['No.14','No.16']],['ถุงมือ',['ผู้ใหญ่','เด็ก']],['สาย ICD No.28/32',['No.28','No.32']],['เอี่ยม/แว่นตา',['เอี่ยม','แว่นตา']],['เครื่อง Othamoscope/otoscope',[]],['Carifix Stretch',[]],['Laryngoscope',[]],['ET-tube No.6',[]],['ET-tube No.6.5',[]],['ET-tube No.7',[]],['ET-tube No.7.5',[]],['ET-tube No.8',[]],['Ambu bag ผู้ใหญ่',[]],['Tracheostomy Tube',[]],['สาย NG no.14/no.16',['No.14','No.16']]]
  const rows:[string,string[]][]=slug==='medication'?medication.map(name=>[name,[]]):slug==='medical-equipment'?equipment:emergency
  return rows.map(([name,labels],itemIndex)=>({id:`local:${slug}:item:${itemIndex}`,name,aliases:[],variants:(labels.length?labels:[null]).map((label,index)=>({id:`local:${slug}:variant:${itemIndex}:${index}`,label,unit:''}))}))
}
