/* global fetch */
import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { argv } from 'node:process'
import { log } from 'node:console'
import ExcelJS from 'exceljs'

const base=argv[2]??'http://127.0.0.1:3000'
for(const format of ['detail','legacy','original']){
  const response=await fetch(`${base}/api/export?period=month&date=2026-10&type=&format=${format}`)
  assert.equal(response.status,200)
  assert.match(response.headers.get('content-type'),/spreadsheetml/)
  assert.match(response.headers.get('content-disposition'),/hospital-inspection-2026-10-/)
  const bytes=Buffer.from(await response.arrayBuffer())
  assert.equal(bytes.byteLength,Number(response.headers.get('content-length')))
  const book=new ExcelJS.Workbook()
  await book.xlsx.load(bytes)
  assert.ok(book.getWorksheet('สรุป'))
  const detail=book.getWorksheet(format==='legacy'?'รูปแบบรายเดือน':'รายละเอียดทั้งหมด')
  assert.ok(detail.rowCount>1)
  log(JSON.stringify({format,status:response.status,bytes:bytes.byteLength,sheets:book.worksheets.map(sheet=>sheet.name),dataRows:detail.rowCount-1}))
}
for(const format of ['original','detail']){
  const response=await fetch(`${base}/api/export?period=all&format=${format}`)
  assert.equal(response.status,200)
  const bytes=Buffer.from(await response.arrayBuffer())
  const book=new ExcelJS.Workbook();await book.xlsx.load(bytes)
  assert.ok(book.worksheets.filter(sheet=>/^2026-/.test(sheet.name)).length>1)
  assert.ok(book.getWorksheet('รายละเอียดทั้งหมด').rowCount>1875)
  if(format==='original'){
    const detail=book.getWorksheet('รายละเอียดทั้งหมด');let verified=0
    for(let r=2;r<=detail.rowCount;r++){
      if(detail.getCell(r,3).value!=='ยา'||detail.getCell(r,6).value)continue
      const date=detail.getCell(r,1).value,shift=detail.getCell(r,2).value,item=detail.getCell(r,5).value,actual=detail.getCell(r,8).value
      const sheet=book.getWorksheet(`${date.toISOString().slice(0,7)} ยา`);assert.ok(sheet)
      const shifted=sheet.getCell('D2').value==='ด'
      let target
      for(let i=2;i<=sheet.rowCount;i++)if(sheet.getCell(i,2).value===item){target=i;break}
      assert.ok(target)
      const column=4+(date.getUTCDate()-1)*(shifted?3:1)+(shifted?{'ดึก':0,'เช้า':1,'บ่าย':2}[shift]:0)
      assert.equal(sheet.getCell(target,column).value,actual)
      verified++
    }
    log(JSON.stringify({verifiedSourceGridCells:verified}))
  }
  log(JSON.stringify({period:'all',format,bytes:bytes.byteLength,sheets:book.worksheets.map(s=>s.name)}))
}
