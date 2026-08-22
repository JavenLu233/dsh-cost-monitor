/**
 * Pricing vocabulary and the DeepSeek default table for the session-cost
 * domain. Prices are denominated in one currency (default CNY) per 1M tokens;
 * `cacheWrite` is priced at the miss rate because a cache write is a
 * full-price prompt token. The default table carries both DeepSeek's flat
 * pricing and the peak/off-peak split: `effectiveAt` (2026-08-17 00:00
 * Beijing) selects flat vs peak/off-peak per event time. Deployments override
 * the table through the plugin Config.
 *
 * @module @javenlu233/dsh-session-cost/pricing
 */

/** Per-1M-token prices for the four disjoint billing buckets, in one currency. */
export interface BucketPrices {
  /** Cache-read input. */
  cacheRead: number
  /** Uncached (cache-miss) input. */
  uncachedInput: number
  /** Cache-write input (billed at the miss rate). */
  cacheWrite: number
  /** Output. */
  output: number
}

/** Flat, peak, and off-peak prices for one model route. */
export interface RoutePrices {
  /** Flat price before {@link CostConfig.effectiveAt}. */
  flat: BucketPrices
  /** Peak price on/after {@link CostConfig.effectiveAt}. */
  peak: BucketPrices
  /** Off-peak price on/after {@link CostConfig.effectiveAt}. */
  offPeak: BucketPrices
}

/** Plugin config: currency, route fallback, the flat→peak switchover, the peak schedule, and the price table. */
export interface CostConfig {
  /** Currency label the prices are denominated in and the projection reports (e.g. `CNY`). */
  currency: string
  /** Route (provider-owned model id) priced when a session reports usage with no recorded route. */
  defaultRoute: string
  /** Epoch ms when peak/off-peak pricing takes effect; earlier events price flat. */
  effectiveAt: number
  /** Peak windows as `[start, end)` hours in the configured timezone; off-peak otherwise. */
  peakWindows: Array<[number, number]>
  /** Fixed UTC offset in minutes the peak windows are expressed in (Beijing = 480). */
  timezoneOffsetMinutes: number
  /** Per-model prices keyed by provider-owned model id (see {@link RoutePrices}). */
  prices: Record<string, RoutePrices>
}

/** DeepSeek v4-flash prices (CNY per 1M tokens). */
const FLASH: RoutePrices = {
  flat: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 2 },
  peak: { cacheRead: 0.10, uncachedInput: 3, cacheWrite: 3, output: 9 },
  offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 },
}

/**
 * DeepSeek v4-flash-vision-exp: same published peak/off-peak rates as flash.
 * Flat mirrors flash for the shared pre-2026-08-17 schedule; the model shipped
 * after that switchover, so live usage always hits peak/offPeak.
 */
const FLASH_VISION: RoutePrices = FLASH

/** DeepSeek v4-pro prices (CNY per 1M tokens). */
const PRO: RoutePrices = {
  flat: { cacheRead: 0.025, uncachedInput: 3, cacheWrite: 3, output: 6 },
  peak: { cacheRead: 0.30, uncachedInput: 9, cacheWrite: 9, output: 27 },
  offPeak: { cacheRead: 0.15, uncachedInput: 4.5, cacheWrite: 4.5, output: 13.5 },
}

/** Default per-model price table keyed by provider-owned model id. */
export const DEFAULT_PRICES: Record<string, RoutePrices> = {
  'deepseek-v4-flash': FLASH,
  'deepseek-v4-flash-vision-exp': FLASH_VISION,
  'deepseek-v4-pro': PRO,
}

/** The plugin's full default config (each field's schema default). */
export const DEFAULT_COST_CONFIG: CostConfig = {
  currency: 'CNY',
  defaultRoute: 'deepseek-v4-flash',
  // 2026-08-17 00:00 Beijing (UTC+8) = 2026-08-16 16:00 UTC.
  effectiveAt: Date.UTC(2026, 7, 17) - 8 * 3_600_000,
  peakWindows: [[9, 12], [14, 18]],
  timezoneOffsetMinutes: 480,
  prices: DEFAULT_PRICES,
}

/** All-zero prices: the fallback when neither a route nor the default is configured. */
export const ZERO_BUCKET_PRICES: BucketPrices = {
  cacheRead: 0,
  uncachedInput: 0,
  cacheWrite: 0,
  output: 0,
}
