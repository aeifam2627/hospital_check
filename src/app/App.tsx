import { ClipboardCheck, FileSpreadsheet, History, LayoutDashboard } from 'lucide-react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from '../pages/HomePage'
import { InspectionPage } from '../pages/InspectionPage'
import { DashboardPage } from '../pages/DashboardPage'
import { HistoryPage } from '../pages/HistoryPage'
import { ReportsPage } from '../pages/ReportsPage'
import { ManageItemsPage } from '../pages/ManageItemsPage'

const nav = [
  { to: '/', label: 'ตรวจวันนี้', icon: ClipboardCheck, match: (path:string)=>path==='/'||path.startsWith('/inspect/') },
  { to: '/dashboard', label: 'สรุปวันนี้', icon: LayoutDashboard, match: (path:string)=>path==='/dashboard' },
  { to: '/history', label: 'ประวัติ', icon: History, match: (path:string)=>path==='/history' },
  { to: '/reports', label: 'รายงาน', icon: FileSpreadsheet, match: (path:string)=>path==='/reports' },
]

export function App() {
  const location=useLocation()
  return <div className="app-shell">
    <main className="main-content" key={location.pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/inspect/:slug" element={<InspectionPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/manage/items" element={<ManageItemsPage />} />
      </Routes>
    </main>
    <nav className="bottom-nav" aria-label="เมนูหลัก">
      {nav.map(({ to, label, icon: Icon, match }) => {const active=match?match(location.pathname):location.pathname===to;return <Link key={to} to={to} aria-current={active?'page':undefined} className={active ? 'nav-item active' : 'nav-item'}>
        <Icon aria-hidden="true" size={21} strokeWidth={2.2} /><span>{label}</span>
      </Link>})}
    </nav>
  </div>
}
