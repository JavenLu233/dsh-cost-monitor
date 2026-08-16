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

/**
 * Compact token count: 517 / 12.2K / 517K / 1.2M (one decimal under three digits).
 * @param tokens - token count.
 * @returns display string.
 */
export function formatTokens(tokens: number): string {
  const scaled = (value: number): string =>
    value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10)
  if (tokens < 1_000) return String(tokens)
  if (tokens < 1_000_000) return `${scaled(tokens / 1_000)}K`
  return `${scaled(tokens / 1_000_000)}M`
}

/**
 * Integer share of `part` in `whole`, as a string for `cost.share`.
 * Positive amounts that round to 0 become `<1` so a sliver is not shown as 0%.
 * @param part - the numerator (cost or tokens).
 * @param whole - the denominator of the same unit.
 * @returns `0` / `<1` / `1`…`100`.
 */
export function sharePercent(part: number, whole: number): string {
  if (whole <= 0 || part <= 0) return '0'
  const rounded = Math.round(part / whole * 100)
  return rounded === 0 ? '<1' : String(rounded)
}
