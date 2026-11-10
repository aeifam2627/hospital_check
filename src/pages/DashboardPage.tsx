import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CalendarDays, CheckCircle2, ChevronDown, Clock3, FileSpreadsheet, TriangleAlert, UserRound } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import { thaiDate, todayBangkok } from '../lib/dates'
import type { DashboardType } from '../types/inspection'
import { DashboardCharts } from '../components/DashboardCharts'

const timeThai=(iso:string|null)=>iso?new Intl.DateTimeFormat('th-TH',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date(iso))+' น.':'—'
const shiftThai=(code:string)=>({daily:'รายวัน',night:'ดึก',morning:'เช้า',afternoon:'บ่าย'} as Record<string,string>)[code]??code

export function DashboardPage(){
  const [params,setParams]=useSearchParams();const date=params.get('date')??todayBangkok()
  const query=useQuery({queryKey:['dashboard',date],queryFn:()=>api.getDashboard(date)})
  function setDate(next:string){setParams({date:next})}
  return <div className="page dashboard-page">
    <header className="page-header"><div><h1>สรุปวันนี้</h1><p>{thaiDate(date)}</p></div><div className="header-actions"><Link className="report-link" to="/reports" aria-label="ส่งออกรายงาน"><FileSpreadsheet size={19}/><span>รายงาน</span></Link><label className="date-picker"><CalendarDays size={18}/><span className="sr-only">เลือกวันที่</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div></header>
    {query.isLoading&&<DashboardSkeleton/>}
    {query.isError&&<div className="error-panel" role="alert"><AlertCircle/><div><strong>โหลดสรุปไม่สำเร็จ</strong><p>ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง</p></div><button onClick={()=>void query.refetch()}>ลองใหม่</button></div>}
    {query.data&&<DashboardContent data={query.data.data} date={date}/>} 
  </div>
}

function DashboardContent({data,date}:{data:{kpi:{difference_count:number};types:DashboardType[]};date:string}){
  const recorded=data.types.reduce((sum,type)=>sum+type.submissions.length,0)
  const recordedTypes=data.types.filter(type=>type.submissions.length>0).length
  return <>
      <section className="kpi-strip" aria-label="ภาพรวมวันนี้">
        <div><span>บันทึกผลแล้ว</span><strong>{recorded}</strong><small>รอบตรวจ</small></div>
        <div><span>มีผลตรวจ</span><strong>{recordedTypes}<small>/{data.types.length}</small></strong><small>ประเภทงาน</small></div>
        <div className={data.kpi.difference_count?'attention':''}><span>ต้องทบทวน</span><strong>{data.kpi.difference_count}</strong><small>ค่าต่างมาตรฐาน</small></div>
      </section>
      <DashboardCharts types={data.types}/>
      <div className="dashboard-list">{data.types.map(type=><TypeSummary key={type.id} type={type} date={date}/>)}</div>
      <div className="definition-note"><CheckCircle2 size={19}/><p><strong>ตรวจแล้ว</strong> หมายถึงมีการบันทึกผลในรอบนั้น ส่วน <strong>ต้องทบทวน</strong> คือจำนวนที่บันทึกไม่ตรงค่ามาตรฐาน ไม่ได้หมายความว่าบันทึกไม่สำเร็จ</p></div>
    </>
}

function TypeSummary({type,date}:{type:DashboardType;date:string}){
  const recorded=type.submissions.length
  const status=type.is_complete?'complete':recorded?'partial':'missing'
  const label=status==='complete'?'บันทึกครบแล้ว':recorded?`มีผลตรวจ ${recorded} รอบ`:'ยังไม่มีผลตรวจ'
  const submittedShifts=new Set(type.submissions.map(item=>item.shift_code))
  const nextShift=type.schedule_mode==='daily'?'daily':(['morning','afternoon','night'] as const).find(code=>!submittedShifts.has(code))??'morning'
  return <details className="summary-card"><summary><div className="summary-title"><strong>{type.title_th}</strong><span className={`summary-status ${status}`}>{label}</span></div><div className="summary-meta"><span><Clock3 size={15}/>{type.latest_submitted_at?`ล่าสุด ${timeThai(type.latest_submitted_at)}`:type.submissions.length?'มีข้อมูลนำเข้าแล้ว':'ยังไม่มีข้อมูล'}</span>{type.latest_inspector&&<span><UserRound size={15}/>{type.latest_inspector}</span>}</div><div className="summary-counts"><span>{type.schedule_mode==='daily'?'วันละ 1 ครั้ง':'เช้า · บ่าย · ดึก'}</span><span className={type.difference_count?'danger-text':''}>{type.difference_count?`${type.difference_count} ค่าต้องทบทวน`:'ไม่มีค่าต้องทบทวน'}</span></div><ChevronDown className="detail-chevron"/></summary>
    <div className="summary-details">
      <Link className="summary-primary-action" to={`/inspect/${type.slug}?date=${date}&shift=${nextShift}`}>{status==='complete'?'ดูหรือแก้ไขผล':'ไปตรวจรายการนี้'}<ArrowRight size={18}/></Link>
      {type.submissions.length>0&&<div className="submission-mini-list">{type.submissions.map(item=><Link to={`/history?from=${date}&to=${date}&type=${type.slug}&submission=${item.id}`} key={item.id}><span><strong>{shiftThai(item.shift_code)}</strong><small>{item.inspector_name} · {timeThai(item.submitted_at)}</small></span><span>{item.difference_count?`${item.difference_count} ต่าง`:'ตรงทั้งหมด'}</span></Link>)}</div>}
      {type.differences.length>0?<div className="difference-list"><h3><TriangleAlert size={18}/>รายการต่างมาตรฐาน</h3>{type.differences.slice(0,8).map((item,index)=><div key={`${item.submission_id}-${index}`}><span><strong>{item.item}</strong>{item.variant&&<small>{item.variant}</small>}</span><span>มาตรฐาน {item.standard_qty} / พบ <b>{item.actual_qty}</b> {item.unit}</span></div>)}</div>:<p className="quiet-state">{type.submissions.length?'จำนวนตรงมาตรฐานทุกรายการ':'ยังไม่มีผลตรวจสำหรับวันนี้'}</p>}
    </div>
  </details>
}
function DashboardSkeleton(){return <div className="dashboard-skeleton" role="status"><span className="sr-only">กำลังโหลดสรุปผล</span><div className="kpi-skeleton skeleton"/>{[1,2,3].map(v=><div className="summary-skeleton skeleton" key={v}/>)}</div>}
