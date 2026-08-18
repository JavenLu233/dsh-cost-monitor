/**
 * The `sessionCost` projection unit: a pure fold of provider usage reports
 * into per-turn, per-route, per-price-bucket token buckets, priced by the
 * configured table at view time.
 *
 * Token attribution mirrors token-meter's `tokenUsage` fold — a usage chunk
 * provides an early sample that survives a later request failure, and an
 * assembled assistant message replaces that step's earlier sample. Each sample
 * is attributed to the newest recorded route (`request/context`) and to a
 * price bucket derived from its event time: `flat` before `config.effectiveAt`,
 * otherwise `peak`/`offPeak` by the configured windows. Prices are applied in
 * `view`, never stored in state, so re-pricing a folded log after a config
 * change needs no re-fold; the schedule and switchover are fold input, so
 * changing them bumps {@link stateVersion}. Chart cuts (`series`, `byRoute`,
 * `byWebSearch`, `bySchedule`, `cacheSaved`) are assembled in `view` from the
 * same cube. Auxiliary `web_search` usage rides `tool/result.meta.sessionCost`
 * and is additive — it never participates in the chunk → message replace.
 *
 * @module @javenlu233/dsh-session-cost/projection
 */

import { z } from 'zod'
import type { TokenUsage } from '@deepseek-ai/dsh-llm'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import { ZERO_BUCKET_PRICES } from './pricing.ts'
import type { BucketPrices, CostConfig } from './pricing.ts'
import { searchCostFromMeta } from './search-usage.ts'
import type { CostSlice, PriceSchedule, SessionCostProjection, TurnCost } from './types.ts'

/** Why a usage sample was billed: the conversation route, or an auxiliary search call. */
type CostPurpose = 'conversation' | 'web_search'

/** Token buckets of one usage sample (mirrors token-meter's disjoint buckets). */
interface CostBuckets {
  uncachedInputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
}

/** Price bucket of one usage sample: flat before the switchover, peak/off-peak after. */
export type PriceBucket = 'flat' | 'peak' | 'offPeak'

/** Separator joining turn, route, bucket, and purpose in a state key (never a model id). */
const ROUTE_SEPARATOR = '\u0000'

/** Fold state: raw token buckets per (turn, route, bucket, purpose) key, plus replace bookkeeping. */
interface SessionCostState {
  /** Token buckets keyed by `turn\u0000route\u0000bucket\u0000purpose`. */
  byKey: Record<string, CostBuckets>
  /** Newest recorded route (from `request/context`); seeded with the configured default. */
  route: string
  /** Last usage sample, for the chunk → message replace semantics. */
  last: { turn: number; step: number; key: string; buckets: CostBuckets } | null
}

const zeroBuckets = (): CostBuckets => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

const bucketsFrom = (usage: {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}): CostBuckets => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
})

const bucketsEqual = (left: CostBuckets, right: CostBuckets): boolean =>
  left.uncachedInputTokens === right.uncachedInputTokens
  && left.outputTokens === right.outputTokens
  && left.cacheReadTokens === right.cacheReadTokens
  && left.cacheWriteTokens === right.cacheWriteTokens

const allZero = (buckets: CostBuckets): boolean =>
  buckets.uncachedInputTokens === 0
  && buckets.outputTokens === 0
  && buckets.cacheReadTokens === 0
  && buckets.cacheWriteTokens === 0

const keyOf = (turn: number, route: string, bucket: PriceBucket, purpose: CostPurpose): string =>
  `${turn}${ROUTE_SEPARATOR}${route}${ROUTE_SEPARATOR}${bucket}${ROUTE_SEPARATOR}${purpose}`

const splitKey = (key: string): {
  turn: number
  route: string
  bucket: PriceBucket
  purpose: CostPurpose
} => {
  const first = key.indexOf(ROUTE_SEPARATOR)
  const second = key.indexOf(ROUTE_SEPARATOR, first + 1)
  const third = key.indexOf(ROUTE_SEPARATOR, second + 1)
  return {
    turn: Number(key.slice(0, first)),
    route: key.slice(first + 1, second),
    bucket: key.slice(second + 1, third) as PriceBucket,
    purpose: key.slice(third + 1) === 'web_search' ? 'web_search' : 'conversation',
  }
}

/** Merge a replace into one (turn, route, bucket) bucket, dropping it when it empties. */
function addToKey(
  byKey: Record<string, CostBuckets>,
  key: string,
  previous: CostBuckets | undefined,
  next: CostBuckets | undefined,
): Record<string, CostBuckets> {
  const current = byKey[key] ?? zeroBuckets()
  const merged: CostBuckets = {
    uncachedInputTokens: current.uncachedInputTokens
      - (previous?.uncachedInputTokens ?? 0) + (next?.uncachedInputTokens ?? 0),
    outputTokens: current.outputTokens - (previous?.outputTokens ?? 0) + (next?.outputTokens ?? 0),
    cacheReadTokens: current.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + (next?.cacheReadTokens ?? 0),
    cacheWriteTokens: current.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + (next?.cacheWriteTokens ?? 0),
  }
  if (allZero(merged)) {
    const { [key]: _removed, ...rest } = byKey
    return rest
  }
  return { ...byKey, [key]: merged }
}

const costBucketSchema = z.object({
  tokens: z.number().int().nonnegative(),
  cost: z.number(),
}).strict()

const turnCostSchema = z.object({
  uncachedInput: z.number(),
  cacheRead: z.number(),
  cacheWrite: z.number(),
  output: z.number(),
}).strict()

const costSliceSchema = z.object({
  uncachedInput: costBucketSchema,
  cacheRead: costBucketSchema,
  cacheWrite: costBucketSchema,
  output: costBucketSchema,
  total: z.number(),
}).strict()

const sessionCostSchema = z.object({
  currency: z.string(),
  total: z.number(),
  billedInputTokens: z.number().int().nonnegative(),
  cacheHitPercent: z.number().int().nullable(),
  uncachedInput: costBucketSchema,
  cacheRead: costBucketSchema,
  cacheWrite: costBucketSchema,
  output: costBucketSchema,
  turns: z.record(z.string(), turnCostSchema),
  series: z.array(costSliceSchema.extend({ turn: z.number().int() }).strict()),
  byRoute: z.array(costSliceSchema.extend({ route: z.string() }).strict()),
  byWebSearch: z.array(costSliceSchema.extend({ route: z.string() }).strict()),
  bySchedule: z.object({
    flat: costSliceSchema,
    peak: costSliceSchema,
    offPeak: costSliceSchema,
  }).strict(),
  cacheSaved: z.number(),
}).strict() as unknown as z.ZodType<SessionCostProjection>

/** Empty priced cut (tokens and cost all 0). */
const zeroSlice = (): CostSlice => ({
  uncachedInput: { tokens: 0, cost: 0 },
  cacheRead: { tokens: 0, cost: 0 },
  cacheWrite: { tokens: 0, cost: 0 },
  output: { tokens: 0, cost: 0 },
  total: 0,
})

/** Add one priced cell into a mutable slice. */
function addPriced(
  slice: CostSlice,
  buckets: CostBuckets,
  priced: { uncachedInput: number; cacheRead: number; cacheWrite: number; output: number },
): void {
  slice.uncachedInput.tokens += buckets.uncachedInputTokens
  slice.uncachedInput.cost += priced.uncachedInput
  slice.cacheRead.tokens += buckets.cacheReadTokens
  slice.cacheRead.cost += priced.cacheRead
  slice.cacheWrite.tokens += buckets.cacheWriteTokens
  slice.cacheWrite.cost += priced.cacheWrite
  slice.output.tokens += buckets.outputTokens
  slice.output.cost += priced.output
  slice.total += priced.uncachedInput + priced.cacheRead + priced.cacheWrite + priced.output
}

/** Get-or-create a zero slice in a keyed map. */
function takeSlice<K>(map: Map<K, CostSlice>, key: K): CostSlice {
  const existing = map.get(key)
  if (existing !== undefined) return existing
  const created = zeroSlice()
  map.set(key, created)
  return created
}

/**
 * Classify a request timestamp into a price bucket: flat before the
 * switchover, otherwise peak/off-peak by the configured windows.
 * @param timeMs - the usage event's Unix epoch milliseconds.
 * @param config - the pricing config carrying the switchover and windows.
 * @returns the price bucket the sample folds into.
 */
export function classifyBucket(timeMs: number, config: CostConfig): PriceBucket {
  if (timeMs < config.effectiveAt) return 'flat'
  const hour = ((Math.floor((timeMs + config.timezoneOffsetMinutes * 60_000) / 3_600_000)) % 24 + 24) % 24
  return config.peakWindows.some(([start, end]) => hour >= start && hour < end) ? 'peak' : 'offPeak'
}

/** Resolve the per-bucket price for one route and bucket, with the configured default as fallback. */
function bucketPriceFor(config: CostConfig, route: string, bucket: PriceBucket): BucketPrices {
  const routePrices = config.prices[route] ?? config.prices[config.defaultRoute]
  if (routePrices === undefined) return ZERO_BUCKET_PRICES
  return routePrices[bucket]
}

/** Price the folded buckets and assemble the wire value (session totals + chart cuts). */
function viewSessionCost(state: SessionCostState, config: CostConfig): SessionCostProjection {
  const totals = zeroBuckets()
  const costs = { uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
  const turns: Record<number, TurnCost> = {}
  const byTurn = new Map<number, CostSlice>()
  const byRoute = new Map<string, CostSlice>()
  const byWebSearch = new Map<string, CostSlice>()
  const bySchedule: Record<PriceSchedule, CostSlice> = {
    flat: zeroSlice(),
    peak: zeroSlice(),
    offPeak: zeroSlice(),
  }
  let cacheSaved = 0
  for (const [key, buckets] of Object.entries(state.byKey)) {
    totals.uncachedInputTokens += buckets.uncachedInputTokens
    totals.outputTokens += buckets.outputTokens
    totals.cacheReadTokens += buckets.cacheReadTokens
    totals.cacheWriteTokens += buckets.cacheWriteTokens
    const { turn, route, bucket, purpose } = splitKey(key)
    const price = bucketPriceFor(config, route, bucket)
    const priced = {
      uncachedInput: buckets.uncachedInputTokens / 1_000_000 * price.uncachedInput,
      cacheRead: buckets.cacheReadTokens / 1_000_000 * price.cacheRead,
      cacheWrite: buckets.cacheWriteTokens / 1_000_000 * price.cacheWrite,
      output: buckets.outputTokens / 1_000_000 * price.output,
    }
    costs.uncachedInput += priced.uncachedInput
    costs.cacheRead += priced.cacheRead
    costs.cacheWrite += priced.cacheWrite
    costs.output += priced.output
    const turnCost = turns[turn] ?? { uncachedInput: 0, cacheRead: 0, cacheWrite: 0, output: 0 }
    turnCost.uncachedInput += priced.uncachedInput
    turnCost.cacheRead += priced.cacheRead
    turnCost.cacheWrite += priced.cacheWrite
    turnCost.output += priced.output
    turns[turn] = turnCost
    addPriced(takeSlice(byTurn, turn), buckets, priced)
    addPriced(takeSlice(byRoute, route), buckets, priced)
    if (purpose === 'web_search') addPriced(takeSlice(byWebSearch, route), buckets, priced)
    addPriced(bySchedule[bucket], buckets, priced)
    cacheSaved += buckets.cacheReadTokens / 1_000_000 * (price.uncachedInput - price.cacheRead)
  }
  const billedInputTokens = totals.uncachedInputTokens + totals.cacheReadTokens + totals.cacheWriteTokens
  return {
    currency: config.currency,
    total: costs.uncachedInput + costs.cacheRead + costs.cacheWrite + costs.output,
    billedInputTokens,
    cacheHitPercent: billedInputTokens === 0
      ? null
      : Math.round(totals.cacheReadTokens / billedInputTokens * 100),
    uncachedInput: { tokens: totals.uncachedInputTokens, cost: costs.uncachedInput },
    cacheRead: { tokens: totals.cacheReadTokens, cost: costs.cacheRead },
    cacheWrite: { tokens: totals.cacheWriteTokens, cost: costs.cacheWrite },
    output: { tokens: totals.outputTokens, cost: costs.output },
    turns,
    series: [...byTurn.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([turn, slice]) => ({ turn, ...slice })),
    byRoute: [...byRoute.entries()]
      .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
      .map(([route, slice]) => ({ route, ...slice })),
    byWebSearch: [...byWebSearch.entries()]
      .sort((left, right) => right[1].total - left[1].total || left[0].localeCompare(right[0]))
      .map(([route, slice]) => ({ route, ...slice })),
    bySchedule,
    cacheSaved,
  }
}

/**
 * Build the `sessionCost` projection unit for one validated config. The config
 * is closed over by `apply` (bucket classification) and `view` (pricing); only
 * the raw token buckets live in state, so it stays plain JSON for the
 * persisted-cache contract.
 * @param config - the plugin's validated pricing config.
 * @returns the definition the plugin registers on `ctx.sessionProjections`.
 */
export function sessionCostProjectionDefinition(config: CostConfig): ProjectionDefinition<'sessionCost', SessionCostState> {
  return {
    key: 'sessionCost',
    schema: sessionCostSchema,
    init: () => ({ byKey: {}, route: config.defaultRoute, last: null }),
    apply: (state, event) => {
      if (event.type === 'request/context') {
        const route = event.data.model
        if (route === state.route) return state
        return { ...state, route }
      }
      if (event.type === 'tool/result') {
        const data = event.data as { turn?: unknown; meta?: unknown }
        if (typeof data.turn !== 'number') return state
        const sample = searchCostFromMeta(data.meta)
        if (sample === undefined) return state
        const buckets = bucketsFrom(sample)
        if (allZero(buckets)) return state
        const route = sample.model
        const key = keyOf(data.turn, route, classifyBucket(event.time, config), 'web_search')
        const byKey = addToKey(state.byKey, key, undefined, buckets)
        if (byKey === state.byKey) return state
        return { ...state, byKey }
      }
      let turn: number
      let step: number
      let usage: TokenUsage
      if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
        ;({ turn, step } = event.data)
        usage = event.data.chunk.usage
      } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
        ;({ turn, step, usage } = event.data)
      } else {
        return state
      }
      const buckets = bucketsFrom(usage)
      const key = keyOf(turn, state.route, classifyBucket(event.time, config), 'conversation')
      const previous = state.last !== null && state.last.turn === turn && state.last.step === step
        ? state.last
        : undefined
      if (previous !== undefined && previous.key === key && bucketsEqual(previous.buckets, buckets)) return state
      let byKey = state.byKey
      if (previous !== undefined) byKey = addToKey(byKey, previous.key, previous.buckets, undefined)
      byKey = addToKey(byKey, key, undefined, buckets)
      return { ...state, byKey, last: { turn, step, key, buckets } }
    },
    view: state => viewSessionCost(state, config),
    stateVersion: 4,
  }
}
