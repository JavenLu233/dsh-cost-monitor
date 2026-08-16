/**
 * The `sessionCost` projection unit: mounting the plugin beside the projection
 * registry serves whole-log token cost folded from provider usage reports;
 * exact pricing and peak/off-peak classification run against the exported
 * definition directly, where event times are controlled. The route attribution
 * (`request/context` → model id) and the chunk → message replace semantics
 * mirror token-meter's `tokenUsage` fold.
 */

import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { createMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionCostPlugin from '@javenlu233/dsh-session-cost'
import { sessionCostProjectionDefinition } from '@javenlu233/dsh-session-cost/src/projection.ts'
import { DEFAULT_COST_CONFIG } from '@javenlu233/dsh-session-cost/src/pricing.ts'
import type { CostConfig } from '@javenlu233/dsh-session-cost/src/pricing.ts'
import type { SessionCostProjection } from '@javenlu233/dsh-session-cost/types'

const message = createMessage({
  role: 'assistant',
  content: [{ type: 'text', text: 'answer' }],
  source: { kind: 'model', provider: 'deepseek', model: 'deepseek-v4-flash' },
})

async function harness(config?: CostConfig): Promise<{ ctx: Context; session: Session }> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(SessionCostPlugin, config ?? DEFAULT_COST_CONFIG)
  return { ctx, session: ctx.sessions.create(SessionId('costed')) }
}

function appendUsage(session: Session, turn: number, step: number): void {
  session.append('assistant/message', {
    turn,
    step,
    message,
    usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
  }, { surfaceOp: 'append', sourceEventSeqs: [] })
}

function cost(session: Session, ctx: Context): SessionCostProjection {
  return ctx.sessionProjections.snapshot(session).values.sessionCost as SessionCostProjection
}

describe('sessionCost projection unit (registry drive)', () => {
  it('serves zero cost on the empty log', async () => {
    const { ctx, session } = await harness()
    expect(cost(session, ctx)).toEqual({
      currency: 'CNY',
      total: 0,
      billedInputTokens: 0,
      cacheHitPercent: null,
      uncachedInput: { tokens: 0, cost: 0 },
      cacheRead: { tokens: 0, cost: 0 },
      cacheWrite: { tokens: 0, cost: 0 },
      output: { tokens: 0, cost: 0 },
      turns: {},
    })
  })

  it('serves whole-log buckets and notifies the change feed', async () => {
    const { ctx, session } = await harness()
    const changes: { key: string; seq: number }[] = []
    ctx.sessionProjections.onChanged((_session, key, _value, seq) => { changes.push({ key, seq }) })
    session.append('request/context', { provider: 'deepseek', model: 'deepseek-v4-pro' })
    appendUsage(session, 1, 1)
    const value = cost(session, ctx)
    expect(value.currency).toBe('CNY')
    expect(value.uncachedInput.tokens).toBe(1_000_000)
    expect(value.cacheRead.tokens).toBe(1_000_000)
    expect(value.output.tokens).toBe(1_000_000)
    expect(value.cacheWrite.tokens).toBe(0)
    expect(value.billedInputTokens).toBe(2_000_000)
    expect(value.cacheHitPercent).toBe(50)
    expect(value.total).toBeGreaterThan(0)
    expect(changes.every(change => change.key === 'sessionCost')).toBe(true)
  })

  it('has no sessionCost key without the plugin, and drops it on unload (HMR safety)', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    const session = ctx.sessions.create(SessionId('costed'))
    expect('sessionCost' in ctx.sessionProjections.snapshot(session).values).toBe(false)
    const fiber = await ctx.plugin(SessionCostPlugin, DEFAULT_COST_CONFIG)
    appendUsage(session, 1, 1)
    expect('sessionCost' in ctx.sessionProjections.snapshot(session).values).toBe(true)
    await fiber.dispose()
    expect('sessionCost' in ctx.sessionProjections.snapshot(session).values).toBe(false)
  })

  it('folds events already in the log when the plugin mounts late (lazy cell build)', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    const session = ctx.sessions.create(SessionId('costed'))
    session.append('request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' })
    appendUsage(session, 1, 1)
    await ctx.plugin(SessionCostPlugin, DEFAULT_COST_CONFIG)
    expect(cost(session, ctx).billedInputTokens).toBe(2_000_000)
  })
})

/** Build one synthetic committed event with a controlled timestamp. */
function at(time: number, type: string, data: unknown): SessionEvent {
  return { type, seq: time, time, data } as unknown as SessionEvent
}

/** Fold a synthetic event list through a fresh definition and view the result. */
function fold(events: readonly SessionEvent[], config: CostConfig = DEFAULT_COST_CONFIG): SessionCostProjection {
  const definition = sessionCostProjectionDefinition(config)
  const state = events.reduce(
    (folded, event) => definition.apply(folded, event),
    definition.init(),
  )
  return definition.view(state)
}

/** Timestamps: Beijing hour = (UTC hour + 8) % 24; peak = [9,12) ∪ [14,18). */
const HOUR = 3_600_000
const PEAK_AM = Date.UTC(2026, 7, 17, 2) // 10:00 Beijing
const OFF_PEAK = Date.UTC(2026, 7, 17, 5) // 13:00 Beijing
const PEAK_PM = Date.UTC(2026, 7, 17, 7) // 15:00 Beijing

/** All four buckets at 1M tokens each: miss 1.5, hit 0.05, write 1.5, output 4.5 (off-peak flash). */
const FULL = { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 }

function usageMessage(time: number, turn: number, step: number, usage: unknown): SessionEvent {
  return at(time, 'assistant/message', { turn, step, message, usage })
}

describe('sessionCost pricing fold (controlled timestamps)', () => {
  it('prices the four buckets at the off-peak flash rate and reports the hit share', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      usageMessage(OFF_PEAK, 1, 1, FULL),
    ])
    expect(value.uncachedInput).toEqual({ tokens: 1_000_000, cost: 1.5 })
    expect(value.cacheRead).toEqual({ tokens: 1_000_000, cost: 0.05 })
    expect(value.cacheWrite).toEqual({ tokens: 1_000_000, cost: 1.5 })
    expect(value.output).toEqual({ tokens: 1_000_000, cost: 4.5 })
    expect(value.total).toBe(7.55)
    expect(value.billedInputTokens).toBe(3_000_000)
    expect(value.cacheHitPercent).toBe(33)
  })

  it('prices peak samples at the peak rate', () => {
    const value = fold([
      at(PEAK_AM, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      usageMessage(PEAK_AM, 1, 1, FULL),
    ])
    expect(value.uncachedInput.cost).toBe(3.0)
    expect(value.cacheRead.cost).toBe(0.10)
    expect(value.total).toBe(15.1)
  })

  it('attributes usage to the recorded model route', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-pro' }),
      usageMessage(OFF_PEAK, 1, 1, FULL),
    ])
    expect(value.uncachedInput.cost).toBe(4.5)
    expect(value.cacheRead.cost).toBe(0.15)
    expect(value.output.cost).toBe(13.5)
    expect(value.total).toBe(22.65)
  })

  it('uses the configured default route when no request/context is recorded', () => {
    const value = fold([usageMessage(OFF_PEAK, 1, 1, FULL)])
    expect(value.uncachedInput.cost).toBe(1.5)
    expect(value.total).toBe(7.55)
  })

  it('falls back to the default price for an unconfigured route', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-unknown' }),
      usageMessage(OFF_PEAK, 1, 1, FULL),
    ])
    expect(value.uncachedInput.cost).toBe(1.5)
    expect(value.total).toBe(7.55)
  })

  it('replaces a usage chunk with its assembled message instead of double counting', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      at(OFF_PEAK, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: FULL } }),
      usageMessage(OFF_PEAK + HOUR, 1, 1, FULL),
    ])
    expect(value.uncachedInput.tokens).toBe(1_000_000)
    expect(value.output.tokens).toBe(1_000_000)
  })

  it('reprices a step whose chunk and message straddle a peak boundary', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      at(OFF_PEAK, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: FULL } }),
      usageMessage(PEAK_PM, 1, 1, FULL),
    ])
    expect(value.uncachedInput.tokens).toBe(1_000_000)
    expect(value.uncachedInput.cost).toBe(3.0)
    expect(value.total).toBe(15.1)
  })

  it('keeps a chunk sample when its step never assembles a message', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      at(OFF_PEAK, 'assistant/chunk', { turn: 1, step: 1, chunk: { type: 'usage', usage: FULL } }),
    ])
    expect(value.uncachedInput.tokens).toBe(1_000_000)
    expect(value.uncachedInput.cost).toBe(1.5)
  })

  it('splits per-turn cost keyed by turn number', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      usageMessage(OFF_PEAK, 1, 1, FULL),
      usageMessage(OFF_PEAK, 2, 1, FULL),
    ])
    expect(value.turns[1]).toEqual({ uncachedInput: 1.5, cacheRead: 0.05, cacheWrite: 1.5, output: 4.5 })
    expect(value.turns[2]).toEqual({ uncachedInput: 1.5, cacheRead: 0.05, cacheWrite: 1.5, output: 4.5 })
  })

  it('splits a model switch across the log', () => {
    const value = fold([
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' }),
      usageMessage(OFF_PEAK, 1, 1, FULL),
      at(OFF_PEAK, 'request/context', { provider: 'deepseek', model: 'deepseek-v4-pro' }),
      usageMessage(OFF_PEAK, 2, 1, FULL),
    ])
    expect(value.uncachedInput.tokens).toBe(2_000_000)
    expect(value.uncachedInput.cost).toBe(1.5 + 4.5)
    expect(value.total).toBe(7.55 + 22.65)
  })

  it('returns the same reference for unrelated events', () => {
    const definition = sessionCostProjectionDefinition(DEFAULT_COST_CONFIG)
    const state = definition.init()
    const untouched = definition.apply(state, at(1, 'user/message', { content: [] }))
    expect(untouched).toBe(state)
  })
})
