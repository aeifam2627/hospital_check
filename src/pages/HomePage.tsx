import { useQuery } from '@tanstack/react-query'
import { AlertCircle, ArrowRight, CheckCircle2, ClipboardCheck, PackageCheck, Pill, Settings2, Siren } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { thaiDate, todayBangkok } from '../lib/dates'

const icons = { medication: Pill, 'emergency-cart': Siren, 'medical-equipment': PackageCheck }

export function HomePage() {
  const date = todayBangkok()
  const query = useQuery({ queryKey: ['types', date], queryFn: () => api.getTypes(date) })
  return <div className="page home-page">
    <header className="home-header">
      <div className="home-identity"><div className="brand-mark"><ClipboardCheck size={24} aria-hidden="true" /></div><div><h1>{import.meta.env.VITE_APP_TITLE ?? 'ระบบตรวจประจำวัน'}</h1><p>{thaiDate(date)}</p></div></div>
      <Link className="manage-link" to="/manage/items"><Settings2 size={18}/><span>จัดการรายการ</span></Link>
    </header>
    <section className="intro-block"><div className="intro-symbol"><ClipboardCheck size={36} aria-hidden="true"/></div><h2>พร้อมสำหรับ<br/>การตรวจวันนี้</h2><p>เลือกงาน ตรวจนับ แล้วบันทึกได้เลย</p><Link to="/history" className="intro-link">ดูผลตรวจที่ผ่านมา <ArrowRight size={17}/></Link></section>
    {query.isLoading && <div className="type-list" aria-label="กำลังโหลด">{[1, 2, 3].map((v) => <div className="type-card skeleton" key={v} />)}</div>}
    {query.isError && <div className="error-panel" role="alert"><AlertCircle aria-hidden="true" /><div><strong>โหลดรายการไม่สำเร็จ</strong><p>ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง</p></div><button type="button" onClick={() => void query.refetch()}>ลองใหม่</button></div>}
    {query.data && <div className="type-list">{query.data.data.map((type) => {
      const Icon = icons[type.slug as keyof typeof icons] ?? ClipboardCheck
      const complete = type.status === 'complete'
      const formShift=type.schedule_mode==='daily'?'daily':'morning'
      const statusText=complete?'ตรวจครบแล้ว':type.completed_slots?`ตรวจแล้ว ${type.completed_slots} จาก ${type.total_slots} รอบ`:'ยังไม่ได้ตรวจวันนี้'
      return <Link className={`type-card category-${type.slug}`} to={`/inspect/${type.slug}?date=${date}&shift=${formShift}`} key={type.id}>
        <span className="type-icon"><Icon size={24} aria-hidden="true" /></span>
        <span className="type-copy"><strong>{type.title_th}</strong><small>{type.schedule_mode === 'daily' ? 'ตรวจวันละ 1 ครั้ง' : 'ตรวจ 3 เวร: เช้า · บ่าย · ดึก'}</small></span>
        <span className={complete ? 'type-status complete' : 'type-status'}>{complete&&<CheckCircle2 size={16} aria-hidden="true"/>}{statusText}</span>
        <span className="type-action">{complete?'ดูหรือแก้ไข':'เปิดแบบฟอร์ม'}<ArrowRight size={18} aria-hidden="true" /></span>
      </Link>
    })}</div>}
    <Link className="manage-entry" to="/manage/items"><Settings2 size={20}/><span><strong>เพิ่มยา / อุปกรณ์</strong><small>จัดการรายการและจำนวนมาตรฐาน</small></span><ArrowRight size={18}/></Link>
  </div>
}
