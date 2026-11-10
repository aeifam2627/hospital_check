const isoFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
})

export function todayBangkok(): string {
  return isoFormatter.format(new Date())
}

export function thaiDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok',
  }).format(new Date(Date.UTC(year, month - 1, day, 12)))
}

export function recordedTime(iso: string | null | undefined): string {
  if (!iso || !Number.isFinite(Date.parse(iso))) return 'ต้นฉบับไม่ระบุเวลาบันทึก'
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Bangkok' }).format(new Date(iso)) + ' น.'
}
