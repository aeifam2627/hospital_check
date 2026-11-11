import ExcelJS from 'exceljs'
import { describe,expect,it } from 'vitest'
import { createInspectionWorkbook, type ExportRow } from '../../server/export-workbook'

const row: ExportRow={work_date:'2026-10-01',shift_code:'morning',category:'ยา',category_slug:'medication',schedule_mode:'shift',group:'',item:'Morphine (ยาเสพติด)',variant:'',standard_qty:2,actual_qty:0,unit:'Amp',inspector_name:'ผู้ตรวจทดสอบ',submitted_at:'2026-10-01T18:30:00Z',source:'web_form'}

it('exports environmental readings with range criteria, decimal values and corrective notes in every format', async () => {
  const reading: ExportRow = { ...row, work_date: '2026-11-11', category: 'อุณหภูมิตู้เย็น', category_slug: 'refrigerator-temperature', item: 'อุณหภูมิตู้เย็น', unit: '°C', standard_qty: 8, comparison_mode: 'range', standard_min: 2, standard_max: 8, actual_qty: 5.25, notes: 'ตรวจซ้ำแล้ว' }
  for (const format of ['original', 'detail', 'legacy'] as const) {
    const book = await createInspectionWorkbook([reading, { ...reading, shift_code: 'afternoon', actual_qty: -1.5 }], '2026-11', format)
    const loaded = new ExcelJS.Workbook(); await loaded.xlsx.load(await book.xlsx.writeBuffer())
    expect(loaded.getWorksheet('สรุป')!.getCell('D5').value).toBe(1)
    expect(loaded.getWorksheet('สรุป')!.getCell('E5').value).toBe(1)
    if (format === 'original') {
      const sheet = loaded.getWorksheet('2026-11 อุณหภูมิตู้เย็น')!
      expect(sheet.getCell('B3').value).toBe('2–8')
      expect(sheet.getCell(3,24).value).toBe(5.25)
      expect(sheet.getCell(3,25).value).toBe(-1.5)
      expect(sheet.getCell(5,24).value).toBe('ตรวจซ้ำแล้ว')
    }
    {
      const detail = loaded.getWorksheet('รายละเอียดทั้งหมด')!
      expect(detail.getCell('G2').value).toBe('2–8')
      expect(detail.getCell('H2').value).toBe(5.25)
      expect(detail.getCell('M2').value).toBe('ตรวจซ้ำแล้ว')
    }
  }
})

describe('Excel export',()=>{
  it('creates a real xlsx workbook with summary and typed date cells',async()=>{
    const workbook=await createInspectionWorkbook([{
      work_date:'2026-11-09',shift_code:'daily',category:'เครื่องมือแพทย์',category_slug:'medical-equipment',schedule_mode:'daily',group:'',item:'เครื่อง Defrib',variant:'',standard_qty:2,actual_qty:0,unit:'เครื่อง',inspector_name:'เจ้าหน้าที่ทดสอบ',submitted_at:'2026-11-09T08:42:00.000Z',source:'web_form',
    }],'2026-11','detail')
    const bytes=await workbook.xlsx.writeBuffer();expect(bytes.byteLength).toBeGreaterThan(5000)
    const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(bytes)
    expect(loaded.getWorksheet('สรุป')).toBeTruthy();const detail=loaded.getWorksheet('รายละเอียดทั้งหมด')!
    expect(detail.getCell('A2').value).toBeInstanceOf(Date)
    expect(detail.getCell('H2').value).toBe(0)
    expect(detail.getCell('H2').fill).toMatchObject({type:'pattern',pattern:'solid'})
  })
  it('creates legacy date columns without combining shifts',async()=>{
    const base={work_date:'2026-11-09',shift_code:'daily',category:'เครื่องมือแพทย์',category_slug:'medical-equipment',schedule_mode:'daily',group:'',item:'BP ตั้งโต๊ะผู้ใหญ่/เด็ก',standard_qty:2,actual_qty:2,unit:'เครื่อง',inspector_name:'ผู้ตรวจ',submitted_at:null,source:'web_form'}
    const workbook=await createInspectionWorkbook([{...base,variant:'ผู้ใหญ่',schedule_mode:'shift',shift_code:'morning'},{...base,variant:'ผู้ใหญ่',schedule_mode:'shift',shift_code:'afternoon',actual_qty:1}],'2026-11','legacy')
    const sheet=workbook.getWorksheet('รูปแบบรายเดือน')!;expect(sheet.rowCount).toBe(3);expect(sheet.getCell('B2').value).not.toBe(sheet.getCell('B3').value)
  })
  it('preserves source row colors, merged date headers, shifts, blanks and numeric zero after xlsx roundtrip',async()=>{
    const workbook=await createInspectionWorkbook([row,{...row,item:'ASA 300 mg',standard_qty:5,actual_qty:5},{...row,item:'RI 10 ml (ตู้เย็น)',actual_qty:null}],'2026-10','original')
    const loaded=new ExcelJS.Workbook();await loaded.xlsx.load(await workbook.xlsx.writeBuffer())
    const sheet=loaded.getWorksheet('2026-10 ยา')!
    expect(sheet.getCell('E3').value).toBe(0)
    expect(sheet.getCell('D3').value).toBeNull()
    expect(sheet.getCell('E26').value).toBeNull()
    expect(sheet.getCell('E1').master.address).toBe('D1')
    expect(sheet.getCell('D1').value).toEqual(new Date('2026-10-01T00:00:00Z'))
    expect(['D2','E2','F2'].map(c=>sheet.getCell(c).value)).toEqual(['ด','ช','บ'])
    for(const address of ['A3','B3','C3','E3'])expect(sheet.getCell(address).fill).toMatchObject({fgColor:{argb:'FFCDBFF1'}})
    expect(sheet.getCell('E18').fill).toMatchObject({fgColor:{argb:'FFFFE599'}})
    expect(sheet.getCell('E26').fill).toMatchObject({fgColor:{argb:'FFB6D7A8'}})
    expect(sheet.getCell('E28').value).toBe('ผู้ตรวจทดสอบ')
    const detail=loaded.getWorksheet('รายละเอียดทั้งหมด')!
    expect(detail.getCell('A2').fill).toMatchObject({fgColor:{argb:'FFCDBFF1'}})
    expect(detail.getCell('K2').value).toEqual(new Date('2026-10-02T01:30:00Z'))
  })
  it('keeps NG and ICD size order in the source layout and all individual detail records',async()=>{
    const tube={...row,category:'รถ Emergency',category_slug:'emergency-cart',unit:'เส้น'}
    const workbook=await createInspectionWorkbook([
      {...tube,item:'สาย NG No.16',standard_qty:5,actual_qty:4},
      {...tube,item:'สาย NG No.14',standard_qty:5,actual_qty:0},
      {...tube,item:'สาย ICD No.32',standard_qty:2,actual_qty:1},
      {...tube,item:'สาย ICD No.28',standard_qty:2,actual_qty:2},
      {...tube,item:'อุปกรณ์ใหม่',actual_qty:7},
    ],'2026-10','original')
    const sheet=workbook.getWorksheet('2026-10 รถ Emergency')!
    expect(sheet.getCell('E36').value).toBe('0/4')
    expect(sheet.getCell('E17').value).toBe('2/1')
    expect(sheet.getCell('E36').numFmt).toBe('@')
    expect(sheet.getCell('A32').value).toBe('ชั้นที่ 4')
    expect(sheet.getCell('B42').value).toBe('อุปกรณ์ใหม่')
    expect(sheet.getCell('E42').value).toBe(7)
    expect(workbook.getWorksheet('รายละเอียดทั้งหมด')!.rowCount).toBe(6)
  })
  it('separates months and preserves the August daily format and leap-month length',async()=>{
    const data=[{...row,work_date:'2026-08-01',shift_code:'daily'},{...row,work_date:'2028-02-29'}]
    const workbook=await createInspectionWorkbook(data,'all','original')
    expect(workbook.getWorksheet('2026-08 ยา')!.getCell('D2').value).toBe(0)
    expect(workbook.getWorksheet('2026-08 ยา')!.columnCount).toBe(34)
    const leap=workbook.getWorksheet('2028-02 ยา')!
    expect(leap.columnCount).toBe(90)
    expect(leap.getCell(3,89).value).toBe(0)
    const detail=await createInspectionWorkbook(data,'all','detail')
    expect(detail.worksheets.map(s=>s.name)).toEqual(['สรุป','รายละเอียดทั้งหมด','2026-08','2028-02'])
    expect(detail.getWorksheet('รายละเอียดทั้งหมด')!.rowCount).toBe(3)
  })
  it('preserves the equipment daily grid and explicit paired quantities',async()=>{
    const equipment={...row,category:'เครื่องมือแพทย์',category_slug:'medical-equipment',schedule_mode:'daily',shift_code:'daily',item:'BP ตั้งโต๊ะผู้ใหญ่/เด็ก',unit:'เครื่อง'}
    const workbook=await createInspectionWorkbook([{...equipment,variant:'เด็ก',standard_qty:1,actual_qty:1},{...equipment,variant:'ผู้ใหญ่',actual_qty:0}],'2026-10','original')
    const sheet=workbook.getWorksheet('2026-10 เครื่องมือแพทย์')!
    expect(sheet.getCell('D12').value).toBe('0/1')
    expect(sheet.getCell('C12').value).toBe('2/1 เครื่อง')
    expect(sheet.getCell('B12').fill).toMatchObject({fgColor:{argb:'FFB6D7A8'}})
    expect(sheet.getCell('C12').fill).toMatchObject({fgColor:{argb:'FFEA9999'}})
    expect(sheet.getCell('B2').value).toBe('เครื่อง Defrib')
    expect(sheet.columnCount).toBe(34)
  })
})
