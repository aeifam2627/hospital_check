import { z } from 'zod'

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
  results: z.array(z.object({ variant_id: z.string().uuid(), actual_qty: z.number().int().min(0).max(99999) })).min(1).max(250),
}).strict()
