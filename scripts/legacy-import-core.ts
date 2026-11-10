import ExcelJS from 'exceljs'

export type LegacyType='medication'|'emergency-cart'|'medical-equipment'
export interface MasterVariant { id:string; label:string|null; unit:string }
export interface MasterItem { id:string; name:string; aliases:string[]; variants:MasterVariant[] }
export interface CellEvidence { sheet_name:string; source_cell:string; raw_value:string|null; parsed_value:unknown; parse_status:'parsed'|'blank'|'ambiguous'|'skipped'; warning?:string }
export interface ParsedSlot { type_slug:LegacyType; work_date:string; shift_code:'daily'|'night'|'morning'|'afternoon'; inspector_name:string; import_status:'complete'|'partial'; legacy_source_key:string; results:Array<{variant_id:string;actual_qty:number}>; evidence:CellEvidence[] }
export interface ImportReport { source_file:string; worksheets:number; parsed_slots:number; converted_cells:number; ambiguous_cells:number; blank_dates:string[]; warnings:string[]; samples:ParsedSlot[]; slots:ParsedSlot[]; evidence:CellEvidence[] }

const monthMap:Record<string,number>={'ม.ค.':1,'มกราคม':1,'jan':1,'ก.พ.':2,'กุมภาพันธ์':2,'feb':2,'มี.ค.':3,'มีนาคม':3,'mar':3,'เม.ย.':4,'เมษายน':4,'apr':4,'พ.ค.':5,'พฤษภาคม':5,'may':5,'มิ.ย.':6,'มิถุนายน':6,'jun':6,'ก.ค.':7,'กรกฎาคม':7,'jul':7,'ส.ค.':8,'สิงหาคม':8,'aug':8,'ก.ย.':9,'กันยายน':9,'sep':9,'ต.ค.':10,'ตุลาคม':10,'oct':10,'พ.ย.':11,'พฤศจิกายน':11,'nov':11,'ธ.ค.':12,'ธันวาคม':12,'dec':12}
const shiftMap:Record<string,ParsedSlot['shift_code']>={'ด':'night','ดึก':'night','night':'night','ช':'morning','เช้า':'morning','morning':'morning','บ':'afternoon','บ่าย':'afternoon','afternoon':'afternoon'}
const aliasPairs:Record<string,string>={
  'เครื่อง othamoscope':'เครื่อง othamoscope/otoscope','เครื่อง otoscope':'เครื่อง othamoscope/otoscope',
  othamoscope:'เครื่อง othamoscope/otoscope',otoscope:'เครื่อง othamoscope/otoscope',
  'carifix stretch1':'carifix stretch','infusion pump bodyguard':'infusion pump body grad',
  'urin space':'เครื่องตรวจ urin space','สาย suction no14/16':'สาย suction no.14/16',
  'สาย icd no.28,32':'สาย icd no.28/32','เข็ม biosy (1ชุดมี 3ชิ้น)':'เข็ม biosy (1 ชุดมี 3 ชิ้น)',
}

export const normalize=(value:string)=>value.toLocaleLowerCase('th').normalize('NFKC').replace(/[–—_-]/g,' ').replace(/\s+/g,' ').replace(/\s*([/.])\s*/g,'$1').trim()
const compact=(value:string)=>normalize(value).replace(/[.\s]/g,'')
const display=(value:ExcelJS.CellValue):string|null=>{if(value==null)return null;if(value instanceof Date)return value.toISOString();if(typeof value==='object'){if('result'in value)return display(value.result as ExcelJS.CellValue);if('text'in value)return String(value.text)}return String(value)}
const raw=(cell:ExcelJS.Cell)=>display(cell.value)

export function inferLegacyType(fileName:string):LegacyType|null {const n=normalize(fileName);if(n.includes('emergency')||n.includes('รถ'))return'emergency-cart';if(n.includes('เครื่องมือ'))return'medical-equipment';if(n.includes('ยา'))return'medication';return null}
export function parseSheetPeriod(name:string):{year:number;month:number}|null {
  const n=compact(name);let month=0
  for(const [token,value]of Object.entries(monthMap).sort((a,b)=>b[0].length-a[0].length))if(n.includes(compact(token))){month=value;break}
  const match=n.match(/(25\d{2}|20\d{2}|\d{2})(?!\d)/);if(!month||!match)return null
  let year=Number(match[1]);if(year<100)year+=2500;if(year>2400)year-=543
  return year>=2000&&year<=2100?{year,month}:null
}

function dateHeader(cell:ExcelJS.Cell):number|null {const value=cell.value;if(value instanceof Date)return value.getUTCDate();if(typeof value==='number'&&Number.isInteger(value)&&value>=1&&value<=31)return value;const text=raw(cell)?.trim();if(!text)return null;const match=text.match(/^(\d{1,2})(?:\s|$|[/.])/);const day=match?Number(match[1]):Number(text);return Number.isInteger(day)&&day>=1&&day<=31?day:null}
function validDate(year:number,month:number,day:number){const date=new Date(Date.UTC(year,month-1,day));return date.getUTCFullYear()===year&&date.getUTCMonth()===month-1&&date.getUTCDate()===day}
const iso=(y:number,m:number,d:number)=>`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

function findHeader(sheet:ExcelJS.Worksheet){
  let best:{row:number;columns:Array<{column:number;day:number}>;unique:number}|null=null
  for(let r=1;r<=Math.min(18,sheet.rowCount);r++){
    const columns=[] as Array<{column:number;day:number}>
    for(let c=1;c<=sheet.columnCount;c++){const day=dateHeader(sheet.getCell(r,c));if(day)columns.push({column:c,day})}
    const monotonic=columns.every((value,index)=>index===0||value.day>=columns[index-1]!.day)
    const unique=new Set(columns.map(value=>value.day)).size
    // Data rows often contain long runs of the same quantity (for example 2,2,2...).
    // Prefer the row with the most distinct day numbers, not merely the most numeric cells.
    if(columns.length>=2&&unique>=2&&monotonic&&(!best||unique>best.unique||unique===best.unique&&columns.length>best.columns.length))best={row:r,columns,unique}
  }
  return best
}
function itemMatch(text:string,items:MasterItem[]){const n=normalize(text);const canonical=aliasPairs[n]??n;return items.find(item=>[item.name,...item.aliases].some(name=>(aliasPairs[normalize(name)]??normalize(name))===canonical))??null}
function parseCount(value:ExcelJS.CellValue,variantCount:number,numFmt:string):{status:'parsed';values:number[]}|{status:'blank'}|{status:'ambiguous';warning:string}{
  if(value==null||value==='')return{status:'blank'}
  if(value instanceof Date)return{status:'ambiguous',warning:'Excel แปลงค่าเป็นวันที่/serial date; ต้องตรวจต้นฉบับ'}
  const resolved=typeof value==='object'&&value&&'result'in value?value.result:value
  if(typeof resolved==='number'){
    if(!Number.isInteger(resolved)||resolved<0)return{status:'ambiguous',warning:'จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0'}
    if((resolved>=30000&&resolved<=60000)||(Boolean(numFmt)&&/[dmy]/i.test(numFmt)))return{status:'ambiguous',warning:`ค่าตัวเลข ${resolved} มีลักษณะเป็น Excel Date Serial`}
    if(variantCount!==1)return{status:'ambiguous',warning:'รายการหลายชนิดย่อยแต่พบตัวเลขเดียว'}
    return{status:'parsed',values:[resolved]}
  }
  const text=String(resolved).trim();if(!text)return{status:'blank'}
  const parts=text.split(/[/,，]/).map(v=>v.trim());if(parts.length!==variantCount||parts.some(v=>!/^\d+$/.test(v)))return{status:'ambiguous',warning:`รูปแบบ "${text}" ไม่ตรงกับ ${variantCount} ชนิดย่อย`}
  return{status:'parsed',values:parts.map(Number)}
}

export function parseWorkbook(workbook:ExcelJS.Workbook,sourceFile:string,type:LegacyType,master:MasterItem[],checksum:string):ImportReport{
  const warnings:string[]=[],evidence:CellEvidence[]=[],slots:ParsedSlot[]=[],blankDates:string[]=[]
  for(const sheet of workbook.worksheets){const period=parseSheetPeriod(sheet.name);if(!period){warnings.push(`${sheet.name}: อ่านเดือน/ปีจากชื่อ sheet ไม่ได้`);continue}const header=findHeader(sheet);if(!header){warnings.push(`${sheet.name}: ไม่พบแถวหัววันที่`);continue}
    const descriptors:Array<{column:number;day:number;shift:ParsedSlot['shift_code']}>=[]
    const dateStarts=header.columns.filter(x=>validDate(period.year,period.month,x.day)).sort((a,b)=>a.column-b.column)
    for(let i=0;i<dateStarts.length;i++){const current=dateStarts[i]!,next=dateStarts[i+1]?.column??sheet.columnCount+1;const expectsShift=type!=='medical-equipment'&&period.month>=9
      if(expectsShift){for(let c=current.column;c<next;c++){let found:ParsedSlot['shift_code']|null=null;for(let r=header.row+1;r<=Math.min(header.row+3,sheet.rowCount);r++){const label=normalize(raw(sheet.getCell(r,c))??'');if(shiftMap[label]){found=shiftMap[label];break}}if(found)descriptors.push({column:c,day:current.day,shift:found})}if(!descriptors.some(d=>d.day===current.day))warnings.push(`${sheet.name}: วันที่ ${current.day} ไม่พบหัวเวร ด/ช/บ`)
      }else descriptors.push({column:current.column,day:current.day,shift:'daily'})}
    const slotMap=new Map<string,{results:ParsedSlot['results'];evidence:CellEvidence[];inspector:string;seen:Set<string>}>();for(const d of descriptors){const key=`${iso(period.year,period.month,d.day)}:${d.shift}`;slotMap.set(key,{results:[],evidence:[],inspector:'',seen:new Set()})}
    for(let row=header.row+1;row<=sheet.rowCount;row++){let labelCell:ExcelJS.Cell|null=null,unmatchedCell:ExcelJS.Cell|null=null,matched:MasterItem|null=null;for(let c=1;c<Math.min(...descriptors.map(d=>d.column),sheet.columnCount+1);c++){const text=raw(sheet.getCell(row,c));if(!text)continue;unmatchedCell??=sheet.getCell(row,c);if(normalize(text).includes('ผู้ตรวจ')){labelCell=sheet.getCell(row,c);break}const item=itemMatch(text,master);if(item){labelCell=sheet.getCell(row,c);matched=item;break}}
      if(labelCell&&!matched&&normalize(raw(labelCell)??'').includes('ผู้ตรวจ')){for(const d of descriptors){const name=raw(sheet.getCell(row,d.column))?.trim();if(name)slotMap.get(`${iso(period.year,period.month,d.day)}:${d.shift}`)!.inspector=name}continue}
      if(!matched){if(unmatchedCell&&descriptors.some(d=>raw(sheet.getCell(row,d.column))!=null)){evidence.push({sheet_name:sheet.name,source_cell:unmatchedCell.address,raw_value:raw(unmatchedCell),parsed_value:null,parse_status:'skipped',warning:'ข้ามแถวที่ไม่ตรงกับ master item'})}continue}
      for(const d of descriptors){const cell=sheet.getCell(row,d.column),parsed=parseCount(cell.value,matched.variants.length,cell.numFmt),base={sheet_name:sheet.name,source_cell:cell.address,raw_value:raw(cell)};const slot=slotMap.get(`${iso(period.year,period.month,d.day)}:${d.shift}`)!
        if(parsed.status==='blank'){const item={...base,parsed_value:null,parse_status:'blank' as const};evidence.push(item);slot.evidence.push(item);continue}
        if(parsed.status==='ambiguous'){const item={...base,parsed_value:null,parse_status:'ambiguous' as const,warning:parsed.warning};evidence.push(item);slot.evidence.push(item);continue}
        parsed.values.forEach((count,index)=>{const variant=matched!.variants[index];if(!variant)return;slot.results.push({variant_id:variant.id,actual_qty:count});slot.seen.add(variant.id)})
        const item={...base,parsed_value:parsed.values,parse_status:'parsed' as const};evidence.push(item);slot.evidence.push(item)
      }}
    const expected=master.reduce((sum,item)=>sum+item.variants.length,0)
    for(const [key,slot]of slotMap){const [workDate,shiftCode]=key.split(':') as [string,ParsedSlot['shift_code']];if(!slot.results.length){blankDates.push(`${sheet.name}:${workDate}:${shiftCode}`);continue}slots.push({type_slug:type,work_date:workDate,shift_code:shiftCode,inspector_name:slot.inspector||'ไม่พบชื่อในต้นฉบับ',import_status:slot.seen.size===expected?'complete':'partial',legacy_source_key:`${checksum}:${sheet.name}:${workDate}:${shiftCode}`,results:slot.results,evidence:slot.evidence})}
  }
  return{source_file:sourceFile,worksheets:workbook.worksheets.length,parsed_slots:slots.length,converted_cells:evidence.filter(e=>e.parse_status==='parsed').length,ambiguous_cells:evidence.filter(e=>e.parse_status==='ambiguous').length,blank_dates:blankDates,warnings,samples:slots.slice(0,10),slots,evidence}
}
