/* global console */
import ExcelJS from 'exceljs'
import { mkdir, writeFile } from 'node:fs/promises'

// Allowlist only inventory cells A:C. Never ship historical counts, names, comments,
// formulas, workbook metadata, or unrelated clinical notes from the raw workbooks.
const sources = [
  ['medication', 'ตาราง OK ยา.xlsx', 27],
  ['emergency-cart', 'ตาราง OK รถ Emergency.xlsx', 41],
  ['medical-equipment', 'ตารางOk เครื่องมือแพทย์.xlsx', 22],
]
const templates = [], styles = [], styleIds = new Map()
function styleId(style) {
  const key = JSON.stringify(style)
  if (!styleIds.has(key)) { styleIds.set(key, styles.length); styles.push(style) }
  return styleIds.get(key)
}
for (const [slug, filename, lastRow] of sources) {
  const book = new ExcelJS.Workbook()
  await book.xlsx.readFile(`private/legacy-excel/${filename}`)
  for (const [index, sheet] of book.worksheets.entries()) {
    const shifted = sheet.getCell('D2').value === 'ด'
    const end = slug === 'medication' && !shifted ? lastRow - 1 : slug === 'emergency-cart' && index === 0 ? 35 : lastRow
    const cols = shifted ? 96 : 34
    const rows = []
    for (let r = 1; r <= end; r++) {
      const source = sheet.getRow(r)
      rows.push({
        height: source.height ?? null,
        labels: [1, 2, 3].map(c => {
          const v = source.getCell(c).value
          return typeof v === 'string' || typeof v === 'number' ? v : null
        }),
        styles: Array.from({ length: cols }, (_, c) => styleId(source.getCell(c + 1).style)),
      })
    }
    templates.push({ slug, month: `2026-${String(index + 8).padStart(2, '0')}`, shifted,
      widths: Array.from({ length: cols }, (_, c) => sheet.getColumn(c + 1).width ?? 8.43), rows })
  }
}
await mkdir('server/templates', { recursive: true })
await writeFile('server/templates/inspection-layouts.json', JSON.stringify({ styles, templates }))
console.log(`Extracted ${templates.length} sanitized layouts, ${styles.length} styles; no recorded results or staff names.`)
