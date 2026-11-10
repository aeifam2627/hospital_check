import type { DashboardData, HistoryData, InspectionFormData, InspectionTypeSummary, Inspector, MasterItemPayload, SubmissionPayload } from '../types/inspection'

export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message) }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => null) as { error?: string } | null
  if (!response.ok) throw new ApiError(body?.error ?? 'ไม่สามารถเชื่อมต่อระบบได้', response.status)
  return body as T
}

export const api = {
  getTypes: (date: string) => request<{ data: InspectionTypeSummary[] }>(`/api/inspection-types?date=${encodeURIComponent(date)}`),
  getInspectors: () => request<{ data: Inspector[] }>('/api/inspectors'),
  getForm: (slug: string, date: string, shift: string) => request<{ data: InspectionFormData }>(
    `/api/inspection-form?type=${encodeURIComponent(slug)}&date=${encodeURIComponent(date)}&shift=${encodeURIComponent(shift)}`,
  ),
  save: (payload: SubmissionPayload) => request<{ data: { id: string; revision_number: number; updated: boolean } }>('/api/submissions', {
    method: 'POST', body: JSON.stringify(payload),
  }),
  addMasterItem:(payload:MasterItemPayload)=>request<{data:{id:string;name:string}}>('/api/master-items',{method:'POST',body:JSON.stringify(payload)}),
  getDashboard: (date: string) => request<{ data: DashboardData }>(`/api/dashboard?date=${encodeURIComponent(date)}`),
  getHistory: (from: string, to: string, type = '', page = 1, limit = 20) => request<{ data: HistoryData }>(`/api/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&type=${encodeURIComponent(type)}&page=${page}&limit=${limit}`),
}
