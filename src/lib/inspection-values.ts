export type InputKind = 'count' | 'temperature' | 'humidity'

export interface StandardRule {
  standard_qty: number
  comparison_mode?: 'exact' | 'range'
  standard_min?: number | null
  standard_max?: number | null
}

export function parseInspectionValue(value: string, kind: InputKind = 'count'): number | null {
  const pattern = kind === 'count' ? /^\d+$/ : /^-?\d+(?:[.,]\d{1,2})?$/
  if (!pattern.test(value)) return null
  const number = Number(value.replace(',', '.'))
  if (!Number.isFinite(number)) return null
  if (kind === 'count') return Number.isSafeInteger(number) && number <= 99999 ? number : null
  if (kind === 'humidity') return number >= 0 && number <= 100 ? number : null
  return number >= -273.15 && number <= 999 ? number : null
}

export function outsideStandard(value: number | null, rule: StandardRule): boolean {
  if (value === null) return true
  if (rule.comparison_mode !== 'range') return value !== rule.standard_qty
  return (rule.standard_min != null && value < rule.standard_min) || (rule.standard_max != null && value > rule.standard_max)
}

export function standardLabel(rule: StandardRule): string {
  if (rule.comparison_mode !== 'range') return String(rule.standard_qty)
  if (rule.standard_min != null && rule.standard_max != null) return `${rule.standard_min}–${rule.standard_max}`
  if (rule.standard_max != null) return `ไม่เกิน ${rule.standard_max}`
  return `ตั้งแต่ ${rule.standard_min}`
}

export const isEnvironmentInspection = (slug: string) => ['refrigerator-temperature', 'room-environment'].includes(slug)
export const inspectionShifts = (slug: string) => isEnvironmentInspection(slug)
  ? ['morning', 'afternoon'] as const : ['morning', 'afternoon', 'night'] as const
