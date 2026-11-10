import { describe, expect, it } from 'vitest'
import { parseCount } from '../../src/pages/InspectionPage'

describe('parseCount', () => {
  it('keeps zero as a completed value', () => expect(parseCount('0')).toBe(0))
  it('rejects blank input', () => expect(parseCount('')).toBeNull())
  it('rejects decimals, negative values and exponent notation', () => {
    expect(parseCount('5.5')).toBeNull()
    expect(parseCount('-1')).toBeNull()
    expect(parseCount('1e2')).toBeNull()
  })
  it('parses a non-negative integer', () => expect(parseCount('24')).toBe(24))
})
