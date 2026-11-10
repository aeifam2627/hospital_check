import { describe,expect,it } from 'vitest'
import { recordedTime } from '../../src/lib/dates'

describe('history timestamps',()=>{
  it('does not convert absent Excel timestamps to the Unix epoch',()=>{
    expect(recordedTime(null)).toBe('ต้นฉบับไม่ระบุเวลาบันทึก')
    expect(recordedTime(undefined)).toBe('ต้นฉบับไม่ระบุเวลาบันทึก')
    expect(recordedTime('invalid')).toBe('ต้นฉบับไม่ระบุเวลาบันทึก')
  })
  it('shows full Buddhist year and Bangkok time for an actual timestamp',()=>{
    const label=recordedTime('2026-11-09T18:30:00Z')
    expect(label).toContain('10 พ.ย. 2569')
    expect(label).toContain('01:30')
  })
})
