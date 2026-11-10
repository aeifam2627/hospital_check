import { useState } from 'react'
import { BarChart3 } from 'lucide-react'
import type { DashboardType } from '../types/inspection'
import '../dashboard-charts.css'

export function DashboardCharts({ types }: { types: DashboardType[] }) {
  const [shift, setShift] = useState('all')
  const series = types.map(type => ({ ...type,
    rounds: type.submissions.filter(s => shift === 'all' || s.shift_code === shift).length,
    fields: type.submissions.reduce((n, s) => n + s.completed_fields, 0),
  }))
  const max = Math.max(1, ...series.map(s => s.rounds))
  return <section className="dashboard-charts" aria-label="กราฟผลการตรวจ">
    <article className="chart-panel">
      <header><BarChart3 size={20} aria-hidden="true"/><div><h2>รอบตรวจแต่ละประเภท</h2><p>จำนวนบันทึกในวันที่เลือก</p></div></header>
      <div className="chart-filters" role="group" aria-label="เวรในกราฟ">{[['all', 'ทั้งหมด'], ['morning', 'เช้า'], ['afternoon', 'บ่าย'], ['night', 'ดึก'], ['daily', 'รายวัน']].map(([value, label]) => <button key={value} type="button" aria-pressed={shift === value} onClick={() => setShift(value!)}>{label}</button>)}</div>
      <div className="chart-bars">{series.map(type => <div className="chart-bar-row" key={type.id}>
        <div><span>{type.title_th}</span><strong>{type.rounds} <small>รอบ</small></strong></div>
        <div className="chart-track" aria-hidden="true"><span className="chart-round-fill" style={{ transform: `scaleX(${type.rounds / max})` }}/></div>
      </div>)}</div>
      <p className="chart-caption">{series.every(t => t.rounds === 0) ? 'ยังไม่มีบันทึกในรอบที่เลือก' : 'นับจากบันทึกจริง ไม่รวมจำนวนครั้งที่แก้ไข'}</p>
    </article>
    <article className="chart-panel">
      <header><BarChart3 size={20} aria-hidden="true"/><div><h2>ผลการนับที่บันทึก</h2><p>รวมทุกรอบในวันที่เลือก · หน่วยเป็นช่องกรอก</p></div></header>
      <div className="chart-legend"><span><i className="chart-match-key"/>ตรงมาตรฐาน</span><span><i className="chart-difference-key"/>ต้องทบทวน</span></div>
      <div className="chart-bars">{series.map(type => {
        const difference = type.difference_count, matching = Math.max(0, type.fields - difference)
        return <div className="chart-bar-row" key={type.id}>
          <div><span>{type.title_th}</span><strong>{type.fields} <small>ช่อง</small></strong></div>
          <div className="chart-track chart-stacked" aria-hidden="true"><span className="chart-match-fill" style={{ flex: matching }}/><span className="chart-difference-fill" style={{ flex: difference }}/></div>
          <small className="chart-values">{type.fields ? `ตรง ${matching} · ทบทวน ${difference}` : 'ยังไม่มีข้อมูล'}</small>
        </div>
      })}</div>
      <p className="chart-caption">ต้องทบทวน = จำนวนต่างมาตรฐานหรือช่องที่ยังไม่ได้กรอก</p>
    </article>
  </section>
}
