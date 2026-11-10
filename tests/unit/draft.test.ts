import { beforeEach, describe, expect, it } from 'vitest'
import { clearDraft, readDraft, writeDraft } from '../../src/lib/draft'

describe('inspection draft', () => {
  beforeEach(() => localStorage.clear())
  it('isolates values by type, date and shift', () => {
    const draft = { values: { a: '0' }, inspectorName: 'ผู้ตรวจ', notes: '', savedAt: new Date().toISOString() }
    writeDraft('medication', '2026-11-09', 'morning', draft)
    expect(readDraft('medication', '2026-11-09', 'morning')).toEqual(draft)
    expect(readDraft('medication', '2026-11-09', 'night')).toBeNull()
  })
  it('clears only the submitted draft', () => {
    writeDraft('medical-equipment', '2026-11-09', 'daily', { values: {}, inspectorName: '', notes: '', savedAt: '' })
    clearDraft('medical-equipment', '2026-11-09', 'daily')
    expect(readDraft('medical-equipment', '2026-11-09', 'daily')).toBeNull()
  })
})
