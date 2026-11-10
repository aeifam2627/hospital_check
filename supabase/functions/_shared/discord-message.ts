const thaiDate=(iso:string)=>new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(`${iso}T12:00:00+07:00`))
const thaiTime=(iso:string)=>new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(iso))
const shift=(code:string)=>({night:'ดึก',morning:'เช้า',afternoon:'บ่าย'} as Record<string,string>)[code]??code
const clean=(value:unknown)=>String(value??'').replace(/@/g,'＠').slice(0,1000)
const nonceFor=(value:string)=>{let a=2166136261,b=2246822519;for(let i=0;i<value.length;i++){a=Math.imul(a^value.charCodeAt(i),16777619);b=Math.imul(b^value.charCodeAt(value.length-1-i),3266489917)}return `${a>>>0}${b>>>0}`}

export function discordBody(payload:Record<string,any>,baseUrl:string,dedupeKey:string){
  if(payload.kind==='submission'){
    const lines=[`[ตรวจสอบ${clean(payload.title_th)}] ${payload.revision_number>0?`แก้ไขบันทึก ครั้งที่ ${payload.revision_number}`:'บันทึกผลเรียบร้อย'}`,`วันที่ตรวจ: ${thaiDate(payload.work_date)}`,`เวลาบันทึก: ${thaiTime(payload.submitted_at)} น. (เวลาไทย)`,`ผู้บันทึก: ${clean(payload.inspector_name)}`]
    if(payload.schedule_mode==='shift') lines.push(`เวร: ${shift(payload.shift_code)}`)
    lines.push(`ตรวจครบ: ${payload.completed_count} ช่อง`,`จำนวนต่างมาตรฐาน: ${payload.difference_count} ช่อง`)
    for(const item of (payload.differences??[]).slice(0,8)) lines.push(`- ${clean(item.item)}${item.variant?` (${clean(item.variant)})`:''}: มาตรฐาน ${item.standard} / พบ ${item.actual} ${clean(item.unit)}`)
    if((payload.differences??[]).length>8) lines.push(`และอีก ${(payload.differences??[]).length-8} ช่อง`)
    lines.push(`ดูรายละเอียด: ${baseUrl}${payload.detail_path}`)
    return {content:lines.join('\n').slice(0,2000),allowed_mentions:{parse:[]},nonce:nonceFor(dedupeKey),enforce_nonce:true}
  }
  const submission=payload.submission as Record<string,any>|null
  const lines=[`[สรุป${clean(payload.title_th)}] ${thaiDate(payload.work_date)}`]
  if(payload.shift_code) lines.push(`เวร: ${shift(payload.shift_code)}`)
  if(submission){lines.push(`ส่งแล้วโดย: ${clean(submission.inspector_name)}`,`เวลาบันทึก: ${thaiTime(submission.submitted_at)} น.`,`ตรวจครบ: ${submission.completed_count} ช่อง`,`จำนวนต่างมาตรฐาน: ${submission.difference_count} ช่อง`);if(submission.notes)lines.push(`หมายเหตุ: ${clean(submission.notes)}`)}else lines.push('ยังไม่พบการบันทึกในรอบนี้')
  return {content:lines.join('\n').slice(0,2000),allowed_mentions:{parse:[]},nonce:nonceFor(dedupeKey),enforce_nonce:true}
}

