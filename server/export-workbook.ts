import ExcelJS from 'exceljs'
import { getSupabaseAdmin } from './supabase.js'
import { addOriginalSheets, originalFill } from './export-original.js'

export type ExportRow = {
  work_date: string; shift_code: string; category: string; category_slug: string; schedule_mode: string
  group: string; item: string; variant: string; standard_qty: number; actual_qty: number | null; unit: string
  inspector_name: string; submitted_at: string | null; source: string
}

export async function loadExportRows(from: string, to: string, typeSlug: string | null): Promise<ExportRow[]> {
  const db = getSupabaseAdmin(); const rows: ExportRow[]=[]; const pageSize=1000
  for(let offset=0;offset<50_000;offset+=pageSize){
    let query=db.from('inspection_results').select(`actual_qty,standard_qty_snapshot,item_name_snapshot,variant_label_snapshot,unit_snapshot,group_name_snapshot,inspection_submissions!inner(work_date,shift_code,inspector_name,submitted_at,source,inspection_types!inner(slug,title_th,schedule_mode))`).gte('inspection_submissions.work_date',from).lte('inspection_submissions.work_date',to).order('id',{ascending:true}).range(offset,offset+pageSize-1)
    if(typeSlug) query=query.eq('inspection_submissions.inspection_types.slug',typeSlug)
    const {data,error}=await query
    if(error) throw error
    for(const raw of (data??[]) as unknown as Array<Record<string,any>>){
      const submission=raw.inspection_submissions as Record<string,any>; const type=submission.inspection_types as Record<string,any>
      rows.push({work_date:submission.work_date,shift_code:submission.shift_code,category:type.title_th,category_slug:type.slug,schedule_mode:type.schedule_mode,group:raw.group_name_snapshot??'',item:raw.item_name_snapshot,variant:raw.variant_label_snapshot??'',standard_qty:raw.standard_qty_snapshot,actual_qty:raw.actual_qty,unit:raw.unit_snapshot,inspector_name:submission.inspector_name,submitted_at:submission.submitted_at,source:submission.source})
    }
    if((data?.length??0)<pageSize) break
    if(offset+pageSize>=50_000) throw Object.assign(new Error('รายงานมีข้อมูลเกิน 50,000 แถว กรุณาเลือกช่วงวันที่หรือประเภทให้แคบลง'),{code:'P0001'})
  }
  return rows.sort((a,b)=>a.work_date.localeCompare(b.work_date)||a.category_slug.localeCompare(b.category_slug)||a.shift_code.localeCompare(b.shift_code)||a.item.localeCompare(b.item)||a.variant.localeCompare(b.variant))
}

const safeSheetName=(name:string)=>name.replace(/[\\/*?:]/g,' ').replaceAll('[',' ').replaceAll(']',' ').slice(0,31)||'ข้อมูล'
const dateCell=(iso:string)=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y!,m!-1,d!))}

export async function createInspectionWorkbook(rows: ExportRow[], periodLabel: string, format: 'detail'|'legacy'|'original') {
  const workbook=new ExcelJS.Workbook(); workbook.creator='Hospital Inspection'; workbook.created=new Date()
  const summary=workbook.addWorksheet('สรุป',{views:[{state:'frozen',ySplit:4}]})
  summary.mergeCells('A1:F1'); summary.getCell('A1').value='รายงานการตรวจประจำวัน'; summary.getCell('A1').font={bold:true,size:16,color:{argb:'FF0B5748'}}
  summary.mergeCells('A2:F2'); summary.getCell('A2').value=`ช่วงรายงาน: ${periodLabel}`
  summary.addRow([]); summary.addRow(['ประเภท','จำนวนรอบ','จำนวนช่อง','ตรงมาตรฐาน','ต่างมาตรฐาน','ผู้ตรวจล่าสุด'])
  const categories=new Map<string,ExportRow[]>(); for(const row of rows){const list=categories.get(row.category)??[];list.push(row);categories.set(row.category,list)}
  for(const [category,list] of categories){const submissions=new Set(list.map(r=>`${r.work_date}:${r.shift_code}`));const matching=list.filter(r=>r.actual_qty===r.standard_qty).length;const latest=[...list].sort((a,b)=>(b.submitted_at??'').localeCompare(a.submitted_at??''))[0]
    summary.addRow([category,submissions.size,list.length,matching,list.length-matching,latest?.inspector_name??'—'])}
  styleSheet(summary,[28,14,14,16,16,24])

  const months=new Map<string,ExportRow[]>()
  for(const row of rows){const month=row.work_date.slice(0,7);const list=months.get(month)??[];list.push(row);months.set(month,list)}
  if(format==='original') {
    addOriginalSheets(workbook,rows)
    addDetailSheet(workbook,'รายละเอียดทั้งหมด',rows)
  } else if(format==='legacy') {
    if(months.size<=1)addLegacySheet(workbook,rows)
    else for(const [month,list] of [...months].sort())addLegacySheet(workbook,list,month)
  } else {
    addDetailSheet(workbook,'รายละเอียดทั้งหมด',rows)
    if(months.size>1)for(const [month,list] of [...months].sort())addDetailSheet(workbook,month,list)
    else for(const [category,list] of categories) addDetailSheet(workbook,safeSheetName(category),list)
  }
  return workbook
}

function addDetailSheet(workbook:ExcelJS.Workbook,name:string,rows:ExportRow[]){
  const sheet=workbook.addWorksheet(name,{views:[{state:'frozen',ySplit:1}]})
  sheet.columns=[
    {header:'วันที่',key:'date',width:15},{header:'เวร',key:'shift',width:12},{header:'ประเภท',key:'category',width:24},{header:'กลุ่ม',key:'group',width:18},
    {header:'รายการ',key:'item',width:34},{header:'ชนิดย่อย',key:'variant',width:16},{header:'มาตรฐาน',key:'standard',width:12},{header:'จำนวนจริง',key:'actual',width:12},
    {header:'หน่วย',key:'unit',width:12},{header:'ผู้ตรวจ',key:'inspector',width:24},{header:'เวลาบันทึก',key:'submitted',width:22},{header:'ที่มา',key:'source',width:14},
  ]
  for(const row of rows){const added=sheet.addRow({date:dateCell(row.work_date),shift:row.schedule_mode==='daily'?'รายวัน':shiftThai(row.shift_code),category:row.category,group:row.group,item:row.item,variant:row.variant,standard:row.standard_qty,actual:row.actual_qty,unit:row.unit,inspector:row.inspector_name,submitted:row.submitted_at?new Date(row.submitted_at):null,source:row.source})
    added.getCell('date').numFmt='[$-th-TH]d mmm yyyy'; added.getCell('submitted').numFmt='[$-th-TH]d mmm yyyy hh:mm'
    // Excel stores wall-clock values without a timezone: explicitly write Bangkok time.
    if(row.submitted_at) added.getCell('submitted').value=new Date(new Date(row.submitted_at).getTime()+7*60*60*1000)
    const fill=originalFill(row)
    if(fill) added.eachCell({includeEmpty:true},cell=>{cell.fill=structuredClone(fill)})
    if(row.actual_qty!==null&&row.actual_qty!==row.standard_qty){added.getCell('actual').font={bold:true,color:{argb:'FF9C1C27'}};added.getCell('actual').note='จำนวนต่างมาตรฐาน'}
  }
  styleSheet(sheet,sheet.columns.map(c=>c.width??12))
}

function addLegacySheet(workbook:ExcelJS.Workbook,rows:ExportRow[],name='รูปแบบรายเดือน'){
  const sheet=workbook.addWorksheet(name,{views:[{state:'frozen',xSplit:5,ySplit:1}]}); const dates=[...new Set(rows.map(r=>r.work_date))].sort()
  sheet.addRow(['ประเภท','เวร','รายการ','ชนิดย่อย','หน่วย',...dates.map(dateCell)])
  const groups=new Map<string,ExportRow[]>(); for(const row of rows){const key=[row.category_slug,row.shift_code,row.item,row.variant,row.unit].join('|');const list=groups.get(key)??[];list.push(row);groups.set(key,list)}
  for(const list of groups.values()){const first=list[0]!;const byDate=new Map(list.map(r=>[r.work_date,r.actual_qty]));const added=sheet.addRow([first.category,first.schedule_mode==='daily'?'รายวัน':shiftThai(first.shift_code),first.item,first.variant,first.unit,...dates.map(d=>byDate.get(d)??null)]);const fill=originalFill(first);if(fill)added.eachCell({includeEmpty:true},cell=>{cell.fill=structuredClone(fill)})}
  for(let col=6;col<=5+dates.length;col++) sheet.getCell(1,col).numFmt='[$-th-TH]d mmm'; styleSheet(sheet,[22,12,34,16,12,...dates.map(()=>12)])
}

function styleSheet(sheet:ExcelJS.Worksheet,widths:number[]){
  const header=sheet.getRow(sheet.name==='สรุป'?4:1);header.font={bold:true,color:{argb:'FFFFFFFF'}};header.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF0B5748'}};header.alignment={vertical:'middle'}
  widths.forEach((width,index)=>{sheet.getColumn(index+1).width=width});sheet.eachRow(row=>{row.alignment={vertical:'top',wrapText:true};row.height=Math.max(row.height??15,20)})
  sheet.autoFilter=sheet.name==='สรุป'?{from:'A4',to:'F4'}:{from:{row:1,column:1},to:{row:1,column:sheet.columnCount}}
}
function shiftThai(code:string){return ({daily:'รายวัน',night:'ดึก',morning:'เช้า',afternoon:'บ่าย'} as Record<string,string>)[code]??code}
