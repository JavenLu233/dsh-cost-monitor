import { describe, expect, it } from 'vitest'
import { DEFAULT_COST_CONFIG } from './pricing.ts'
import { classifyBucket } from './projection.ts'

/** Beijing local time as UTC ms (offset +480 min applied inside classifyBucket). */
const beijing = (y: number, m: number, d: number, h: number, min = 0) =>
  Date.UTC(y, m - 1, d, h - 8, min)

describe('classifyBucket peak schedule', () => {
  it('classifies Tue 10:00 Beijing as peak after the switchover', () => {
    expect(classifyBucket(beijing(2026, 8, 18, 10), DEFAULT_COST_CONFIG)).toBe('peak')
  })

  it('classifies Tue 13:00 Beijing as off-peak (between windows)', () => {
    expect(classifyBucket(beijing(2026, 8, 18, 13), DEFAULT_COST_CONFIG)).toBe('offPeak')
  })

  it('classifies Sat 10:00 Beijing as off-peak even inside a peak window', () => {
    expect(classifyBucket(beijing(2026, 8, 22, 10), DEFAULT_COST_CONFIG)).toBe('offPeak')
  })

  it('classifies Sun 15:00 Beijing as off-peak', () => {
    expect(classifyBucket(beijing(2026, 8, 23, 15), DEFAULT_COST_CONFIG)).toBe('offPeak')
  })

  it('classifies events before effectiveAt as flat', () => {
    expect(classifyBucket(beijing(2026, 8, 18, 10), {
      ...DEFAULT_COST_CONFIG,
      effectiveAt: beijing(2026, 8, 19, 0),
    })).toBe('flat')
  })
})
