import type ExcelJS from 'exceljs'
import layouts from './templates/inspection-layouts.json'
import type { ExportRow } from './export-workbook.js'

type Layout = typeof layouts.templates[number]
const normalize = (name: string) => name.toLowerCase().replace(/\s+/g, '')
const aliases: Record<string, string> = {
  'เครื่อง Othamoscope': 'เครื่อง Othamoscope/otoscope', 'เครื่อง otoscope': 'เครื่อง Othamoscope/otoscope',
  'Carifix Stretch1': 'Carifix Stretch', 'สาย ICD No.28,32': 'สาย ICD No.28/32',
}
const canonical = (name: string) => normalize(aliases[name.trim()] ?? name)
const pairs: Record<string, string[]> = Object.fromEntries(Object.entries({
  'สาย NG no.14/no.16': ['No.14', 'No.16'], 'สาย ICD No.28/32': ['No.28', 'No.32'],
  'สาย suction No.14/16': ['No.14', 'No.16'], 'กรรไกร,ไฟฉาย': ['กรรไกร', 'ไฟฉาย'],
  'เอี่ยม/แว่นตา': ['เอี่ยม', 'แว่นตา'], 'BP ตั้งโต๊ะผู้ใหญ่/เด็ก': ['ผู้ใหญ่', 'เด็ก'],
  'กรรไกรตัดไหม/ตัดเนื้อ': ['ตัดไหม', 'ตัดเนื้อ'], 'Atery โค้ง/ตรง': ['โค้ง', 'ตรง'],
}).map(([k, v]) => [canonical(k), v]))

function layoutFor(slug: string, month: string, shifted?: boolean) {
  const choices = layouts.templates.filter(t => t.slug === slug && (shifted === undefined || t.shifted === shifted))
  return choices.find(t => t.month === month) ?? choices.at(-1)
}
function matchedRow(template: Layout, data: ExportRow) {
  let name = canonical(data.item)
  if (/^สายngno\.(14|16)$/.test(name)) name = canonical('สาย NG no.14/no.16')
  if (/^สายicdno\.(28|32)$/.test(name)) name = canonical('สาย ICD No.28/32')
  const order = pairs[name]
  const part = data.variant || data.item.match(/No\.\d+$/i)?.[0] || ''
  if (order && !order.some(p => normalize(p) === normalize(part))) return -1
  return template.rows.findIndex((r, i) => i > (template.shifted ? 1 : 0) && canonical(String(r.labels[1] ?? '')) === name)
}
export function originalFill(data: ExportRow): ExcelJS.Fill | undefined {
  const template = layoutFor(data.category_slug, data.work_date.slice(0, 7))
  if (!template) return undefined
  const index = matchedRow(template, data)
  if (index < 0) return undefined
  return structuredClone(layouts.styles[template.rows[index]!.styles[1]!]!.fill) as ExcelJS.Fill
}

export function addOriginalSheets(book: ExcelJS.Workbook, rows: ExportRow[]) {
  const batches = new Map<string, ExportRow[]>()
  for (const row of rows) {
    const key = `${row.work_date.slice(0, 7)}|${row.category_slug}|${row.shift_code === 'daily' ? 'daily' : 'shift'}`
    const batch = batches.get(key) ?? []; batch.push(row); batches.set(key, batch)
  }
  for (const [key, batch] of [...batches].sort(([a], [b]) => a.localeCompare(b))) {
    const [month, slug, mode] = key.split('|') as [string, string, string]
    const template = layoutFor(slug, month, mode === 'shift')
    if (!template) throw new Error(`No Excel template for ${slug}`)
    const title = ({ medication: 'ยา', 'emergency-cart': 'รถ Emergency', 'medical-equipment': 'เครื่องมือแพทย์' } as Record<string, string>)[slug]!
    const both = [...batches.keys()].filter(k => k.startsWith(`${month}|${slug}|`)).length > 1
    const sheet = book.addWorksheet(`${month} ${title}${both && mode === 'daily' ? ' วัน' : ''}`, { views: [{ state: 'frozen', xSplit: 3, ySplit: template.shifted ? 2 : 1 }] })
    const [year, m] = month.split('-').map(Number)
    const days = new Date(Date.UTC(year!, m!, 0)).getUTCDate()
    const shifts = template.shifted ? ['night', 'morning', 'afternoon'] : ['daily']
    const columns = 3 + days * shifts.length
    for (let c = 1; c <= columns; c++) sheet.getColumn(c).width = template.widths[c - 1] ?? template.widths[3]!
    template.rows.forEach((row, i) => {
      const target = sheet.getRow(i + 1)
      if (row.height) target.height = row.height
      for (let c = 1; c <= columns; c++) {
        const cell = target.getCell(c)
        cell.style = structuredClone(layouts.styles[row.styles[c - 1] ?? row.styles[3]!]!) as Partial<ExcelJS.Style>
        if (c <= 3) cell.value = row.labels[c - 1] ?? null
      }
    })
    for (let day = 1; day <= days; day++) {
      const col = 4 + (day - 1) * shifts.length
      if (template.shifted) sheet.mergeCells(1, col, 1, col + 2)
      sheet.getCell(1, col).value = new Date(Date.UTC(year!, m! - 1, day))
      sheet.getCell(1, col).numFmt = 'd'
      if (template.shifted) ['ด', 'ช', 'บ'].forEach((label, i) => { sheet.getCell(2, col + i).value = label })
    }
    const extras = new Map<string, number>(), values = new Map<string, ExportRow[]>()
    for (const row of batch) {
      let r = matchedRow(template, row) + 1
      if (r === 0) {
        const extraKey = `${row.group}|${row.item}|${row.variant}|${row.unit}`
        if (!extras.has(extraKey)) {
          const extraRow = template.rows.length + extras.size + 1
          extras.set(extraKey, extraRow)
          const added = sheet.getRow(extraRow)
          added.getCell(1).value = row.group || 'เพิ่ม'
          added.getCell(2).value = `${row.item}${row.variant ? ` (${row.variant})` : ''}`
          for (let c = 1; c <= columns; c++) {
            added.getCell(c).style = structuredClone(sheet.getCell(template.rows.length, c).style)
            // New items have no source row color; keep them visually distinct from source inventory.
            added.getCell(c).fill = { type: 'pattern', pattern: 'none' }
          }
          added.height = 30
        }
        r = extras.get(extraKey)!
      }
      const col = 4 + (Number(row.work_date.slice(8)) - 1) * shifts.length + shifts.indexOf(row.shift_code)
      const cellKey = `${r}|${col}`
      const list = values.get(cellKey) ?? []; list.push(row); values.set(cellKey, list)
    }
    for (const [cellKey, list] of values) {
      const [r, c] = cellKey.split('|').map(Number) as [number, number]
      const label = String(sheet.getCell(r, 2).value ?? '')
      const order = pairs[canonical(label)]
      const part = (row: ExportRow) => row.variant || row.item.match(/No\.\d+$/i)?.[0] || ''
      const ordered = order ? order.map(p => list.find(row => normalize(part(row)) === normalize(p))) : list
      const cell = sheet.getCell(r, c)
      if (ordered.length === 1) cell.value = ordered[0]?.actual_qty ?? null
      else { cell.value = ordered.map(row => row?.actual_qty ?? '').join('/'); cell.numFmt = '@' }
      const standards = ordered.map(row => row?.standard_qty ?? '').join('/')
      // Recorded standard snapshots take precedence over the old template's quantities.
      sheet.getCell(r, 3).value = `${standards} ${list[0]!.unit}`
      sheet.getCell(r, 3).numFmt = '@'
      cell.note = list.map(row => `${row.item}${row.variant ? ` (${row.variant})` : ''}: ${row.actual_qty ?? 'ไม่ได้กรอก'} / ${row.standard_qty} ${row.unit}\nผู้ตรวจ: ${row.inspector_name}`).join('\n')
      if (list.some(row => row.actual_qty !== null && row.actual_qty !== row.standard_qty)) {
        cell.font = { ...cell.font, color: { argb: 'FF9C1C27' }, bold: true }
      }
    }
    const footer = template.rows.length + extras.size + 1
    sheet.getCell(footer, 2).value = 'ผู้ตรวจ'
    sheet.getRow(footer).height = 75
    for (const row of batch) {
      const c = 4 + (Number(row.work_date.slice(8)) - 1) * shifts.length + shifts.indexOf(row.shift_code)
      sheet.getCell(footer, c).value = row.inspector_name
      sheet.getCell(footer, c).alignment = { textRotation: 90, vertical: 'middle', horizontal: 'center' }
    }
    sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0, printTitlesRow: `1:${template.shifted ? 2 : 1}`, printArea: `A1:${sheet.getCell(footer, columns).address}` }
    sheet.headerFooter.oddHeader = `&C${title} — ${month} (พ.ศ. ${year! + 543})`
    sheet.headerFooter.oddFooter = '&Lช่องว่าง = ไม่มีข้อมูล · ค่าตัวแดง = ต่างมาตรฐาน · รายละเอียดแยกชนิดอยู่ในชีตรายละเอียดทั้งหมด&R&P / &N'
  }
}
