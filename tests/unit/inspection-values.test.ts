import { describe, expect, it } from 'vitest'
import { outsideStandard, parseInspectionValue, standardLabel } from '../../src/lib/inspection-values'
import { submissionSchema } from '../../server/validation'

const refrigerator = { standard_qty: 8, comparison_mode: 'range' as const, standard_min: 2, standard_max: 8 }
const payload = { type_slug: 'refrigerator-temperature', work_date: '2026-11-11', shift_code: 'morning', inspector_name: 'ผู้ตรวจ', notes: '', revision_expected: 0, idempotency_key: '00000000-0000-4000-8000-000000000001', results: [{ variant_id: '00000000-0000-4000-8000-000000000002', actual_qty: -1.25 }] }

describe('environmental readings', () => {
  it('accepts decimals, decimal commas, negative temperatures and zero', () => {
    expect(parseInspectionValue('-1.25', 'temperature')).toBe(-1.25)
    expect(parseInspectionValue('5,5', 'temperature')).toBe(5.5)
    expect(parseInspectionValue('0', 'humidity')).toBe(0)
    for (const value of ['', '-', '5.', '1e2', 'NaN', '2.333']) expect(parseInspectionValue(value, 'temperature')).toBeNull()
    for (const value of ['-1', '100.01']) expect(parseInspectionValue(value, 'humidity')).toBeNull()
  })
  it('compares inclusive range boundaries and preserves count equality', () => {
    for (const value of [2, 5.5, 8]) expect(outsideStandard(value, refrigerator)).toBe(false)
    for (const value of [-1.25, 1.99, 8.01, null]) expect(outsideStandard(value, refrigerator)).toBe(true)
    const room = { ...refrigerator, standard_min: null, standard_max: 24 }
    expect(outsideStandard(24, room)).toBe(false)
    expect(outsideStandard(24.01, room)).toBe(true)
    expect(outsideStandard(23, room)).toBe(false)
    expect(outsideStandard(1, { standard_qty: 2 })).toBe(true)
    expect(standardLabel(refrigerator)).toBe('2–8')
    expect(standardLabel(room)).toBe('ไม่เกิน 24')
  })
  it('accepts measured API values while retaining integer-only inventory counts', () => {
    expect(submissionSchema.parse(payload).results[0]!.actual_qty).toBe(-1.25)
    expect(() => submissionSchema.parse({ ...payload, type_slug: 'medication' })).toThrow()
    expect(() => submissionSchema.parse({ ...payload, results: [{ ...payload.results[0], actual_qty: 1.234 }] })).toThrow()
    expect(() => submissionSchema.parse({ ...payload, results: [payload.results[0], payload.results[0]] })).toThrow()
  })
})
