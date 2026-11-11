import { z } from 'zod'
import { isEnvironmentInspection } from '../src/lib/inspection-values.js'

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
export const shiftCode = z.enum(['daily', 'night', 'morning', 'afternoon'])
export const submissionSchema = z.object({
  type_slug: z.string().regex(/^[a-z0-9-]{2,64}$/),
  work_date: isoDate,
  shift_code: shiftCode,
  inspector_name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(500).default(''),
  revision_expected: z.number().int().min(0),
  idempotency_key: z.string().uuid(),
  results: z.array(z.object({ variant_id: z.string().uuid(), actual_qty: z.number().min(-273.15).max(99999) }).strict()).min(1).max(250),
}).strict().superRefine((payload, context) => {
  const measurement = isEnvironmentInspection(payload.type_slug)
  payload.results.forEach((result, index) => {
    const value = result.actual_qty
    const valid = measurement
      ? value <= 999 && Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
      : Number.isInteger(value) && value >= 0
    if (!valid) context.addIssue({ code: 'custom', path: ['results', index, 'actual_qty'], message: measurement ? 'กรอกค่าทศนิยมไม่เกิน 2 ตำแหน่ง' : 'จำนวนต้องเป็นจำนวนเต็มตั้งแต่ 0 ถึง 99999' })
  })
  if (new Set(payload.results.map(result => result.variant_id)).size !== payload.results.length) {
    context.addIssue({ code: 'custom', path: ['results'], message: 'พบรายการซ้ำ' })
  }
})
