import ExcelJS from 'exceljs'
import { describe,expect,it } from 'vitest'
import { parseSheetPeriod,parseWorkbook,type MasterItem } from '../../scripts/legacy-import-core'

describe('legacy Excel parser',()=>{
  it('reads Buddhist sheet month/year and preserves zero while skipping blank dates',()=>{
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('ส.ค. 2569')
    sheet.getCell('B2').value=1;sheet.getCell('C2').value=2;sheet.getCell('A4').value='เครื่อง Defrib';sheet.getCell('B4').value=0;sheet.getCell('C4').value=null
    const master:MasterItem[]=[{id:'i1',name:'เครื่อง Defrib',aliases:[],variants:[{id:'00000000-0000-4000-8000-000000000001',label:null,unit:'เครื่อง'}]}]
    const report=parseWorkbook(workbook,'ตารางOk เครื่องมือแพทย์.xlsx','medical-equipment',master,'abc')
    expect(parseSheetPeriod('ส.ค. 2569')).toEqual({year:2026,month:8})
    expect(report.slots).toHaveLength(1);expect(report.slots[0]?.results[0]?.actual_qty).toBe(0);expect(report.slots[0]?.work_date).toBe('2026-08-01')
    expect(report.blank_dates).toContain('ส.ค. 2569:2026-08-02:daily')
  })
  it('reads compact two-digit Buddhist years and does not mistake repeated quantities for a header',()=>{
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('สค69')
    ;[1,2,3].forEach((day,index)=>sheet.getCell(1,index+4).value=day)
    sheet.getCell('A2').value=1;sheet.getCell('B2').value='เครื่อง Defrib'
    ;['D2','E2','F2'].forEach(address=>sheet.getCell(address).value=2)
    const master:MasterItem[]=[{id:'i1',name:'เครื่อง Defrib',aliases:[],variants:[{id:'v1',label:null,unit:'เครื่อง'}]}]
    const report=parseWorkbook(workbook,'equipment.xlsx','medical-equipment',master,'abc')
    expect(parseSheetPeriod('สค69')).toEqual({year:2026,month:8})
    expect(parseSheetPeriod('ตค .69 ')).toEqual({year:2026,month:10})
    expect(report.slots.map(slot=>slot.work_date)).toEqual(['2026-08-01','2026-08-02','2026-08-03'])
  })
  it('maps merged date headers to shifts, splits variant values, and blocks serial dates',()=>{
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('ก.ย. 2569')
    sheet.mergeCells('B2:D2');sheet.getCell('B2').value=1;sheet.mergeCells('E2:G2');sheet.getCell('E2').value=2
    ;['ด','ช','บ','ด','ช','บ'].forEach((value,index)=>sheet.getCell(3,index+2).value=value)
    sheet.getCell('A5').value='สาย suction No.14/16';sheet.getCell('B5').value='5/5';sheet.getCell('C5').value=0;sheet.getCell('D5').value=new Date(Date.UTC(2026,0,1))
    const master:MasterItem[]=[{id:'i1',name:'สาย suction No.14/16',aliases:[],variants:[{id:'00000000-0000-4000-8000-000000000014',label:'No.14',unit:'เส้น'},{id:'00000000-0000-4000-8000-000000000016',label:'No.16',unit:'เส้น'}]}]
    const first=parseWorkbook(workbook,'ตาราง OK รถ Emergency.xlsx','emergency-cart',master,'checksum')
    const second=parseWorkbook(workbook,'ตาราง OK รถ Emergency.xlsx','emergency-cart',master,'checksum')
    expect(first.slots[0]?.shift_code).toBe('night');expect(first.slots[0]?.results.map(r=>r.actual_qty)).toEqual([5,5])
    expect(first.ambiguous_cells).toBe(2);expect(first.evidence.some(e=>/serial date|excel แปลง/i.test(e.warning??''))).toBe(true)
    expect(first.slots[0]?.legacy_source_key).toBe(second.slots[0]?.legacy_source_key)
  })
  it('does not treat unrelated rows under the table as inspection items',()=>{
    const workbook=new ExcelJS.Workbook(),sheet=workbook.addWorksheet('พ.ย. 2569');sheet.getCell('B2').value=1;sheet.getCell('C2').value=2;sheet.getCell('A4').value='รายชื่อผู้ป่วย';sheet.getCell('B4').value=10
    const report=parseWorkbook(workbook,'equipment.xlsx','medical-equipment',[{id:'i',name:'เครื่อง Defrib',aliases:[],variants:[{id:'v',label:null,unit:'เครื่อง'}]}],'x')
    expect(report.slots).toHaveLength(0);expect(report.converted_cells).toBe(0);expect(report.evidence[0]?.parse_status).toBe('skipped')
  })
})
