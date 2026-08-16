// @vitest-environment jsdom
/**
 * Display-helper unit tests: the money formatter. All pricing and the per-turn
 * split now live in the host `sessionCost` projection, so the client has no
 * price table to test.
 */
import { describe, expect, it } from 'vitest'
import { formatCost } from '../src/client/cost.ts'

describe('formatCost', () => {
  it('formats two decimals and sub-cent four decimals', () => {
    expect(formatCost(0)).toBe('¥0.00')
    expect(formatCost(12.05)).toBe('¥12.05')
    expect(formatCost(0.005)).toBe('¥0.0050')
  })

  it('prefixes the currency label for non-CNY currencies', () => {
    expect(formatCost(1.5, 'USD')).toBe('USD 1.50')
    expect(formatCost(0.005, 'USD')).toBe('USD 0.0050')
  })
})
