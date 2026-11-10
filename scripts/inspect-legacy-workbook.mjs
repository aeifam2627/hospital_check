/* global process, console */
import ExcelJS from 'exceljs'
import { readFile } from 'node:fs/promises'

const file=process.argv[2]
if(!file){console.error('Usage: node scripts/inspect-legacy-workbook.mjs <file>');process.exit(2)}
const maxRows=Number(process.argv[3]??22)
const maxCols=Number(process.argv[4]??18)
const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await readFile(file))
for(const sheet of workbook.worksheets){
  console.log(`\n=== ${sheet.name} rows=${sheet.rowCount} cols=${sheet.columnCount} ===`)
  console.log('merges:',Object.keys(sheet._merges??{}).slice(0,30).join(', '))
  for(let row=1;row<=Math.min(sheet.rowCount,maxRows);row++){
    const cells=[]
    for(let col=1;col<=Math.min(sheet.columnCount,maxCols);col++){
      const cell=sheet.getCell(row,col);let value=cell.value
      if(value&&typeof value==='object'&&'result'in value)value=value.result
      if(value instanceof Date)value=`DATE:${value.toISOString().slice(0,10)}`
      if(value!==null&&value!==undefined&&String(value).trim()!=='')cells.push(`${cell.address}=${JSON.stringify(value)}${cell.numFmt?`[${cell.numFmt}]`:''}`)
    }
    if(cells.length)console.log(cells.join(' | '))
  }
}
