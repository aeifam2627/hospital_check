/* global console, process */
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile, readdir, copyFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

// Vite/Vitest can hide native Node ESM loading errors. Check the compiled API
// and workbook directly in Node, without a bundler or database credentials.
const base = resolve('private/runtime-checks')
await mkdir(base, { recursive: true })
const output = await mkdtemp(join(base, 'export-'))
for (const directory of ['api', 'server', 'src/lib']) {
  await mkdir(join(output, directory), { recursive: true })
  const names = directory === 'api' ? ['export.ts'] : directory === 'src/lib' ? ['inspection-values.ts'] : (await readdir(directory)).filter(name => name.endsWith('.ts'))
  for (const name of names) {
    const source = await readFile(join(directory, name), 'utf8')
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, esModuleInterop: true } })
    await writeFile(join(output, directory, name.replace(/\.ts$/, '.js')), compiled.outputText)
  }
}
await mkdir(join(output, 'server/templates'), { recursive: true })
await copyFile('server/templates/inspection-layouts.json', join(output, 'server/templates/inspection-layouts.json'))
const endpoint = await import(pathToFileURL(join(output, 'api/export.js')).href)
assert.equal(typeof endpoint.default, 'function')
const { createInspectionWorkbook } = await import(pathToFileURL(join(output, 'server/export-workbook.js')).href)
const sample = { work_date: '2026-10-01', shift_code: 'morning', category: 'ยา', category_slug: 'medication', schedule_mode: 'shift', group: '', item: 'Morphine (ยาเสพติด)', variant: '', standard_qty: 2, actual_qty: 0, unit: 'Amp', inspector_name: 'Runtime test', submitted_at: null, source: 'web_form' }
for (const format of ['original', 'detail', 'legacy']) {
  const environment = { ...sample, work_date: '2026-11-11', category: 'อุณหภูมิตู้เย็น', category_slug: 'refrigerator-temperature', item: 'อุณหภูมิตู้เย็น', unit: '°C', actual_qty: -1.25, standard_qty: 8, comparison_mode: 'range', standard_min: 2, standard_max: 8, notes: 'ตรวจซ้ำแล้ว' }
  const book = await createInspectionWorkbook([sample, environment], 'all', format)
  const bytes = await book.xlsx.writeBuffer()
  assert.ok(bytes.byteLength > 5000)
  console.log(JSON.stringify({ runtime: process.version, apiLoaded: true, format, bytes: bytes.byteLength }))
}
