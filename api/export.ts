import type { VercelRequest,VercelResponse } from '@vercel/node'
import { z } from 'zod'
import { allowRequest,handleError,queryValue } from '../server/http.js'
import { createInspectionWorkbook,loadExportRows } from '../server/export-workbook.js'
import { enforceRateLimit } from '../server/rate-limit.js'

const schema=z.object({period:z.enum(['day','month','year','all']),date:z.string().default(''),type:z.string().max(64).optional().transform(v=>v||null),format:z.enum(['detail','legacy','original']).default('original')}).superRefine((value,ctx)=>{if(value.period==='all')return;const pattern=value.period==='day'?/^\d{4}-\d{2}-\d{2}$/:value.period==='month'?/^\d{4}-\d{2}$/:/^\d{4}$/;const [y,m=1,d=1]=value.date.split('-').map(Number);if(!pattern.test(value.date)||y!<1900||y!>9999||m!<1||m!>12||d!<1||d!>new Date(Date.UTC(y!,m!,0)).getUTCDate())ctx.addIssue({code:'custom',path:['date'],message:'รูปแบบวันที่ไม่ตรงกับช่วงรายงาน'})})
function range(period:string,date:string){if(period==='all')return{from:'1900-01-01',to:'9999-12-31',label:'all'};const [y,m=1,d=1]=date.split('-').map(Number);if(period==='day'){const iso=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return {from:iso,to:iso,label:iso}}
 if(period==='month'){const last=new Date(Date.UTC(y!,m!,0)).getUTCDate();return{from:`${y}-${String(m).padStart(2,'0')}-01`,to:`${y}-${String(m).padStart(2,'0')}-${last}`,label:`${y}-${String(m).padStart(2,'0')}`}}
 return{from:`${y}-01-01`,to:`${y}-12-31`,label:String(y)}}

export default async function handler(req:VercelRequest,res:VercelResponse){if(!allowRequest(req,res,['GET']))return
 try{if(!await enforceRateLimit(req,res,'export',10,60))return;const q=schema.parse({period:queryValue(req,'period'),date:queryValue(req,'date'),type:queryValue(req,'type'),format:queryValue(req,'format')});const dates=range(q.period,q.date);const rows=await loadExportRows(dates.from,dates.to,q.type);const workbook=await createInspectionWorkbook(rows,dates.label,q.format);const buffer=await workbook.xlsx.writeBuffer();const filename=`hospital-inspection-${dates.label}-${q.format}.xlsx`;res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');res.setHeader('Content-Disposition',`attachment; filename="${filename}"`);res.setHeader('Content-Length',String(buffer.byteLength));res.statusCode=200;return res.end(Buffer.from(buffer))}catch(error){return handleError(error,res)}}
