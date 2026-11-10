import { ArrowLeft, Construction } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ComingSoonPage({ title }: { title: string }) {
  return <section className="state-page">
    <Construction size={34} aria-hidden="true" />
    <h1>{title}</h1>
    <p>ส่วนนี้อยู่ใน Phase B หลังจากทดสอบหน้าบันทึกบนมือถือกับเจ้าหน้าที่แล้ว</p>
    <Link className="secondary-button" to="/"><ArrowLeft size={18} /> กลับหน้าหลัก</Link>
  </section>
}
