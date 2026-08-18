/**
 * Function plugin registering the `sessionCost` projection unit: whole-log
 * token cost folded from provider usage reports and priced by a configurable
 * per-model, peak/off-peak table, served through the session-projection seam
 * (registry snapshot, change feed, and every projection carrier), so clients
 * render full-session figures that paging and compaction cannot change. The
 * plugin also captures auxiliary DeepSeek `web_search` Messages usage (the
 * harness logs the request but not the tokens) onto `tool/result.meta`.
 *
 * @module @javenlu233/dsh-session-cost
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { DEFAULT_COST_CONFIG, DEFAULT_PRICES } from './pricing.ts'
import type { CostConfig } from './pricing.ts'
import { installSearchCostCapture } from './capture.ts'
import { sessionCostProjectionDefinition } from './projection.ts'

export type { BucketPrices, RoutePrices } from './pricing.ts'

/** The plugin config: currency, route fallback, peak schedule, and the price table. */
export type Config = CostConfig

/** Cordis plugin name. */
export const name = 'session-cost'
/** The projection registry is the plugin's whole purpose; without it the fiber stays pending. */
export const inject = ['sessionProjections']

const bucketPricesSchema = z.object({
  cacheRead: z.number(),
  uncachedInput: z.number(),
  cacheWrite: z.number(),
  output: z.number(),
})

/** Loader schema; defaults to the DeepSeek flat + peak/off-peak table. */
export const Config = z.object({
  currency: z.string().default(DEFAULT_COST_CONFIG.currency),
  defaultRoute: z.string().default(DEFAULT_COST_CONFIG.defaultRoute),
  effectiveAt: z.number().default(DEFAULT_COST_CONFIG.effectiveAt),
  peakWindows: z.array(z.tuple([z.number(), z.number()])).default(DEFAULT_COST_CONFIG.peakWindows),
  timezoneOffsetMinutes: z.number().default(DEFAULT_COST_CONFIG.timezoneOffsetMinutes),
  prices: z.dict(z.object({
    flat: bucketPricesSchema,
    peak: bucketPricesSchema,
    offPeak: bucketPricesSchema,
  })).default(DEFAULT_PRICES),
}) as unknown as z<Config>

/**
 * Register the `sessionCost` unit; the registration is an effect on this
 * plugin's fiber, so unloading removes the key.
 * @param ctx - registrant context carrying the projection registry.
 * @param config - validated pricing config closed over by the fold and view.
 */
export function apply(ctx: Context, config: Config): void {
  ctx.sessionProjections.register(sessionCostProjectionDefinition(config))
  installSearchCostCapture(ctx)
}
