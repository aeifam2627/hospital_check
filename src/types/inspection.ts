export type ShiftCode = 'daily' | 'night' | 'morning' | 'afternoon'

export interface InspectionTypeSummary {
  id: string
  slug: string
  title_th: string
  schedule_mode: 'daily' | 'shift'
  status: 'pending' | 'complete' | 'incomplete'
  completed_slots: number
  total_slots: number
}

export interface InspectionVariant {
  id: string
  variant_label: string | null
  unit: string
  standard_qty: number
  input_kind?: 'count' | 'temperature' | 'humidity'
  comparison_mode?: 'exact' | 'range'
  standard_min?: number | null
  standard_max?: number | null
}

export interface InspectionItem {
  id: string
  name: string
  variants: InspectionVariant[]
}

export interface InspectionGroup {
  id: string | null
  name: string | null
  items: InspectionItem[]
}

export interface InspectionFormData {
  type: { id: string; slug: string; title_th: string; schedule_mode: 'daily' | 'shift' }
  work_date: string
  shift_code: ShiftCode
  schedules: Array<{ shift_code: ShiftCode; required: boolean }>
  groups: InspectionGroup[]
  existing_submission: null | {
    id: string
    revision_number: number
    inspector_name: string
    notes: string | null
    results: Array<{ variant_id: string; actual_qty: number | null }>
  }
}

export interface Inspector { id: string; display_name: string }

export interface SubmissionPayload {
  type_slug: string
  work_date: string
  shift_code: ShiftCode
  inspector_name: string
  notes: string
  revision_expected: number
  idempotency_key: string
  results: Array<{ variant_id: string; actual_qty: number }>
}

export interface MasterItemPayload {
  type_slug:string; name:string; variant_label:string; unit:string; standard_qty:number; effective_from:string; group_name:string
}

export interface DifferenceItem {
  submission_id?: string
  shift_code?: ShiftCode
  item: string
  variant: string | null
  standard_qty: number
  comparison_mode?: 'exact' | 'range'
  standard_min?: number | null
  standard_max?: number | null
  actual_qty: number
  unit: string
}

export interface DashboardType {
  id: string; slug: string; title_th: string; schedule_mode: 'daily' | 'shift'
  expected_slots: number; submitted_slots: number; is_complete: boolean | null
  latest_submitted_at: string | null; latest_inspector: string | null; difference_count: number
  submissions: Array<{ id: string; shift_code: ShiftCode; inspector_name: string; submitted_at: string; completed_fields: number; difference_count: number; revision_number: number }>
  differences: DifferenceItem[]
}

export interface DashboardData {
  work_date: string
  kpi: { expected_slots: number; submitted_slots: number; missing_slots: number; difference_count: number }
  types: DashboardType[]
}

export interface HistoryItem {
  id: string; type_slug: string; title_th: string; schedule_mode: 'daily' | 'shift'; work_date: string
  shift_code: ShiftCode; inspector_name: string; notes: string | null; submitted_at: string | null
  revision_number: number; completed_fields: number; difference_count: number; differences: DifferenceItem[]
}

export interface HistoryData { total: number; items: HistoryItem[] }
