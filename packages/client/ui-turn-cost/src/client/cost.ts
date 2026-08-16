/**
 * Display helper for the cost readouts. Client-safe: no cordis, no React, no
 * price table — the host's `sessionCost` projection owns all pricing and the
 * per-turn split, so this file only turns a number into a currency string.
 */

/**
 * Format a cost in the projection's currency: two decimals normally, four for
 * sub-cent amounts so a fraction of a cent still shows.
 * @param cost - cost in the projection's currency units.
 * @param currency - the projection's currency label (default `CNY`, shown as `¥`).
 * @returns the prefixed, rounded display string.
 */
export function formatCost(cost: number, currency = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : `${currency} `
  const decimals = cost > 0 && cost < 0.01 ? 4 : 2
  return `${symbol}${cost.toFixed(decimals)}`
}
