/**
 * Pure types of the session-cost domain: the ONE home of the `sessionCost`
 * projection-key declaration, free of this package's host-side value imports
 * (cordis context, zod, the llm TokenUsage type). Two namespace projections
 * serve it — `./types` for host consumers, `./client` for client aggregates —
 * with zero content duplication.
 *
 * @module @javenlu233/dsh-session-cost/types
 */

// Marks this file a module so the declaration below AUGMENTS the projection
// table instead of declaring an ambient module.
export {}

/** One token bucket's cost breakdown: its tokens and the computed cost. */
export interface CostBucket {
  /** Provider-reported disjoint token count for this bucket. */
  tokens: number
  /** Cost in the projection's currency (priced at the configured per-1M rate). */
  cost: number
}

/** One turn's cost across the four billing buckets, for the "this turn" readout. */
export interface TurnCost {
  /** Uncached (cache-miss) input cost. */
  uncachedInput: number
  /** Cache-read input cost. */
  cacheRead: number
  /** Cache-write input cost (billed at the miss rate). */
  cacheWrite: number
  /** Output cost. */
  output: number
}

/**
 * Whole-log session cost, folded from provider usage reports and priced by the
 * configured table. Every field is 0 until its first contributing event; the
 * currency labels the configured unit and `total` is the sum of the four
 * bucket costs. `turns` carries the same split per turn number, so a
 * per-message readout can show "this turn" without any client-side pricing.
 */
export interface SessionCostProjection {
  /** Currency label the configured prices are denominated in (e.g. `CNY`). */
  currency: string
  /** Sum of the four bucket costs. */
  total: number
  /** Prompt-side billed tokens: uncached + cache read + cache write. */
  billedInputTokens: number
  /** Rounded integer cache-hit share of billed input, or null when no input was billed. */
  cacheHitPercent: number | null
  /** Uncached (cache-miss) input bucket. */
  uncachedInput: CostBucket
  /** Cache-read input bucket. */
  cacheRead: CostBucket
  /** Cache-write input bucket (billed at the miss rate). */
  cacheWrite: CostBucket
  /** Output bucket. */
  output: CostBucket
  /** Per-turn cost keyed by turn number, for the per-message "this turn" readout. */
  turns: Record<number, TurnCost>
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Whole-log session cost; see {@link SessionCostProjection}. */
    sessionCost: SessionCostProjection
  }
}
