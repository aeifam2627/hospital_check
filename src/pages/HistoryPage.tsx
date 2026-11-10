import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ChevronDown, Clock3, SearchX, TriangleAlert, UserRound } from 'lucide-react'
import { api } from '../lib/api'
import { recordedTime, thaiDate, todayBangkok } from '../lib/dates'
import { useSearchParams } from 'react-router-dom'
import type { HistoryItem } from '../types/inspection'

const monthStart=(iso:string)=>`${iso.slice(0,7)}-01`
const shiftThai=(code:string)=>({daily:'รายวัน',night:'ดึก',morning:'เช้า',afternoon:'บ่าย'} as Record<string,string>)[code]??code

export function HistoryPage(){
  const [url,setUrl]=useSearchParams(),today=todayBangkok();const from=url.get('from')??monthStart(today),to=url.get('to')??today,type=url.get('type')??'',submission=url.get('submission'),page=Math.max(1,Number(url.get('page')??1)||1),pageSize=20
  const query=useQuery({queryKey:['history',from,to,type,page],queryFn:()=>api.getHistory(from,to,type,page,pageSize)})
  function update(key:string,value:string){const next=new URLSearchParams(url);next.set(key,value);next.delete('submission');next.set('page','1');setUrl(next)}
  function setPage(nextPage:number){const next=new URLSearchParams(url);next.set('page',String(nextPage));setUrl(next)}
  return <div className="page history-page"><header className="page-header"><div><h1>ประวัติการตรวจ</h1><p>ค้นหาและดูผลต่างมาตรฐานย้อนหลัง</p></div></header>
    <section className="history-filters"><label><span>ตั้งแต่</span><input type="date" value={from} onChange={e=>update('from',e.target.value)}/></label><label><span>ถึง</span><input type="date" value={to} onChange={e=>update('to',e.target.value)}/></label><label><span>ประเภท</span><select value={type} onChange={e=>update('type',e.target.value)}><option value="">ทุกประเภท</option><option value="medication">ยา</option><option value="emergency-cart">รถ Emergency</option><option value="medical-equipment">เครื่องมือแพทย์</option></select></label></section>
    {query.isLoading&&<div role="status" className="history-list">{[1,2,3].map(v=><div className="history-skeleton skeleton" key={v}/>)}</div>}
    {query.isError&&<div className="error-panel" role="alert"><AlertCircle/><div><strong>โหลดประวัติไม่สำเร็จ</strong><p>ลองใหม่อีกครั้ง</p></div><button onClick={()=>void query.refetch()}>ลองใหม่</button></div>}
    {query.data&&query.data.data.items.length===0&&<div className="empty-state"><SearchX size={30}/><strong>ไม่พบประวัติในช่วงนี้</strong><span>ลองเปลี่ยนวันที่หรือประเภทการตรวจ</span></div>}
    {query.data&&<><div className="history-list">{query.data.data.items.map(item=><HistoryCard key={item.id} item={item} open={submission===item.id}/>)}</div>{query.data.data.total>pageSize&&<nav className="pagination" aria-label="หน้าประวัติ"><button type="button" disabled={page===1} onClick={()=>setPage(page-1)}>ก่อนหน้า</button><span>หน้า {page} / {Math.ceil(query.data.data.total/pageSize)}</span><button type="button" disabled={page*pageSize>=query.data.data.total} onClick={()=>setPage(page+1)}>ถัดไป</button></nav>}</>}
  </div>
}
function HistoryCard({item,open}:{item:HistoryItem;open:boolean}){
  return <details className="history-card" open={open}>
    <summary>
      <div className="history-date"><span>{thaiDate(item.work_date)}</span><span className="shift-badge">{item.shift_code==='daily'?'ตรวจรายวัน':`เวร${shiftThai(item.shift_code)}`}</span></div>
      <div className="history-main"><strong>{item.title_th}</strong></div>
      <div className="history-meta"><span><UserRound size={16} aria-hidden="true"/>{item.inspector_name}</span><span><Clock3 size={16} aria-hidden="true"/>{item.submitted_at?'บันทึกเมื่อ ':''}{recordedTime(item.submitted_at)}</span></div>
      <div className="history-result"><span className={item.difference_count?'result-chip warning':'result-chip good'}>{item.difference_count?`ต่างจากมาตรฐาน ${item.difference_count} รายการ`:'จำนวนตรงมาตรฐาน'}</span><span className="disclosure-label">ดูรายละเอียด <ChevronDown size={16}/></span></div>
    </summary>
    <div className="history-detail">{item.differences.length?<div className="difference-list"><h3><TriangleAlert size={18}/>รายการที่ต้องทบทวน</h3>{item.differences.map((diff,index)=><div key={index}><span><strong>{diff.item}</strong>{diff.variant&&<small>{diff.variant}</small>}</span><span>มาตรฐาน {diff.standard_qty} / พบ <b>{diff.actual_qty}</b> {diff.unit}</span></div>)}</div>:<p className="quiet-state">จำนวนตรงมาตรฐานทุกรายการ</p>}{item.notes&&<div className="notes-block"><strong>หมายเหตุ</strong><p>{item.notes}</p></div>}{item.revision_number>0&&<p className="revision-note">มีการแก้ไขผลตรวจ {item.revision_number} ครั้ง</p>}</div>
  </details>
}
