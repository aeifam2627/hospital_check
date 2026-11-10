export interface InspectionDraft {
  values: Record<string, string>
  inspectorName: string
  notes: string
  savedAt: string
}

const key = (slug: string, date: string, shift: string) => `inspection-draft:v1:${slug}:${date}:${shift}`

export function readDraft(slug: string, date: string, shift: string): InspectionDraft | null {
  try {
    const value = localStorage.getItem(key(slug, date, shift))
    return value ? JSON.parse(value) as InspectionDraft : null
  } catch { return null }
}

export function writeDraft(slug: string, date: string, shift: string, draft: InspectionDraft): void {
  localStorage.setItem(key(slug, date, shift), JSON.stringify(draft))
}

export function clearDraft(slug: string, date: string, shift: string): void {
  localStorage.removeItem(key(slug, date, shift))
}
