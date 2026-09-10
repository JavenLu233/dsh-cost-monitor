/**
 * Pricing vocabulary and the DeepSeek default table for the session-cost
 * domain. Prices are denominated in one currency (default CNY) per 1M tokens;
 * `cacheWrite` is priced at the miss rate because a cache write is a
 * full-price prompt token. The default table carries DeepSeek's historical
 * flat pricing, the August peak/off-peak split, and the September V4.1-Flash
 * price cut. Deployments override the table through the plugin Config.
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

/** A later peak/off-peak price revision for one model route. */
export interface RoutePriceUpdate {
  /** Epoch ms when this route revision starts billing. */
  effectiveAt: number
  /** Peak price after the revision. */
  peak: BucketPrices
  /** Off-peak price after the revision. */
  offPeak: BucketPrices
}

/** Flat, peak, and off-peak prices for one model route. */
export interface RoutePrices {
  /** Flat price before {@link CostConfig.effectiveAt}. */
  flat: BucketPrices
  /** Peak price on/after {@link CostConfig.effectiveAt}. */
  peak: BucketPrices
  /** Off-peak price on/after {@link CostConfig.effectiveAt}. */
  offPeak: BucketPrices
  /** Later route-specific peak/off-peak revisions, ordered by effective time. */
  updates?: RoutePriceUpdate[]
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

/** DeepSeek's first V4 Flash prices (CNY per 1M tokens). */
const FLASH: RoutePrices = {
  flat: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 2 },
  peak: { cacheRead: 0.10, uncachedInput: 3, cacheWrite: 3, output: 9 },
  offPeak: { cacheRead: 0.05, uncachedInput: 1.5, cacheWrite: 1.5, output: 4.5 },
}

/** V4.1-Flash price-cut effective time: 2026-09-10 12:00 Beijing. */
export const V41_FLASH_EFFECTIVE_AT = Date.UTC(2026, 8, 10, 4)

/** V4.1-Flash rates published by DeepSeek (CNY per 1M tokens). */
const FLASH_V41_UPDATE: RoutePriceUpdate = {
  effectiveAt: V41_FLASH_EFFECTIVE_AT,
  peak: { cacheRead: 0.04, uncachedInput: 2, cacheWrite: 2, output: 8 },
  offPeak: { cacheRead: 0.02, uncachedInput: 1, cacheWrite: 1, output: 4 },
}

/** DeepSeek V4.1-Flash route history: old V4 rates, then the September cut. */
const FLASH_V41: RoutePrices = { ...FLASH, updates: [FLASH_V41_UPDATE] }

/**
 * Legacy vision route history: it is billed at V4.1-Flash rates after the
 * retirement cut, while historical V4 usage keeps its original rate.
 */
const FLASH_VISION: RoutePrices = FLASH_V41

/** DeepSeek V4-Pro prices before the announced routing change (CNY per 1M tokens). */
const PRO: RoutePrices = {
  flat: { cacheRead: 0.025, uncachedInput: 3, cacheWrite: 3, output: 6 },
  peak: { cacheRead: 0.30, uncachedInput: 9, cacheWrite: 9, output: 27 },
  offPeak: { cacheRead: 0.15, uncachedInput: 4.5, cacheWrite: 4.5, output: 13.5 },
}

/** Pro-to-Flash routing starts 2026-09-14 12:00 Beijing. */
export const V41_PRO_ROUTING_AT = Date.UTC(2026, 8, 14, 4)

/** V4-Pro route history: Pro pricing until routing, then V4.1-Flash pricing. */
const PRO_WITH_ROUTING: RoutePrices = {
  ...PRO,
  updates: [{ ...FLASH_V41_UPDATE, effectiveAt: V41_PRO_ROUTING_AT }],
}

/** Default per-model price table keyed by provider-owned model id. */
export const DEFAULT_PRICES: Record<string, RoutePrices> = {
  'deepseek-flash': FLASH_V41,
  'deepseek-v4-flash': FLASH_V41,
  'deepseek-v4-flash-vision-exp': FLASH_VISION,
  'deepseek-v4-pro': PRO_WITH_ROUTING,
}

/** The plugin's full default config (each field's schema default). */
export const DEFAULT_COST_CONFIG: CostConfig = {
  currency: 'CNY',
  defaultRoute: 'deepseek-flash',
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
