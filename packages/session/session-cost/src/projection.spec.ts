import { describe, expect, it } from 'vitest'
import { DEFAULT_COST_CONFIG } from './pricing.ts'
import { sessionCostProjectionDefinition } from './projection.ts'
import { attachSearchCost } from './search-usage.ts'

/** 2026-08-18 10:00 Beijing — peak after the flat→peak switchover. */
const PEAK = Date.UTC(2026, 7, 18, 2)
/** 2026-09-10 14:00 Beijing — peak after the V4.1-Flash price cut. */
const V41_PEAK = Date.UTC(2026, 8, 10, 6)
/** 2026-09-14 14:00 Beijing — peak after Pro routes to V4.1-Flash. */
const PRO_ROUTING_PEAK = Date.UTC(2026, 8, 14, 6)

type Apply = ReturnType<typeof sessionCostProjectionDefinition>['apply']
type Event = Parameters<Apply>[1]

const event = (type: string, data: unknown, time = PEAK): Event =>
  ({ type, seq: 0, time, data }) as Event

const fold = (...events: Event[]) => {
  const unit = sessionCostProjectionDefinition(DEFAULT_COST_CONFIG)
  return unit.wire!.view(events.reduce<ReturnType<typeof unit.init>>(
    (state, next) => unit.apply(state, next),
    unit.init(),
  ))
}

describe('sessionCost web_search fold', () => {
  it('adds search usage into the triggering turn without replacing conversation usage', () => {
    const cost = fold(
      event('request/context', { model: 'deepseek-v4-pro' }),
      event('assistant/message', {
        turn: 1,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }),
      event('tool/result', {
        turn: 1,
        step: 1,
        message: { source: { kind: 'tool', callId: 'call-1' } },
        meta: attachSearchCost(
          { sources: [], truncated: false },
          { model: 'deepseek-v4-flash', inputTokens: 1_000_000, outputTokens: 1_000_000 },
        ),
      }),
    )
    // pro peak 9+27 plus flash peak 3+9
    expect(cost.total).toBe(9 + 27 + 3 + 9)
    expect(cost.turns[1]).toEqual({
      uncachedInput: 9 + 3,
      cacheRead: 0,
      cacheWrite: 0,
      output: 27 + 9,
    })
    expect(cost.byRoute.map(row => ({ route: row.route, total: row.total }))).toEqual([
      { route: 'deepseek-v4-pro', total: 36 },
      { route: 'deepseek-v4-flash', total: 12 },
    ])
    expect(cost.byWebSearch.map(row => ({ route: row.route, total: row.total }))).toEqual([
      { route: 'deepseek-v4-flash', total: 12 },
    ])
  })

  it('keeps search cost when a later same-step usage sample replaces the conversation sample', () => {
    const cost = fold(
      event('request/context', { model: 'deepseek-v4-pro' }),
      event('assistant/chunk', {
        turn: 1,
        step: 1,
        chunk: { type: 'usage', usage: { inputTokens: 1_000_000, outputTokens: 0 } },
      }),
      event('tool/result', {
        turn: 1,
        step: 1,
        message: { source: { kind: 'tool', callId: 'call-1' } },
        meta: attachSearchCost(
          { sources: [], truncated: false },
          { model: 'deepseek-v4-flash', inputTokens: 0, outputTokens: 1_000_000 },
        ),
      }),
      event('assistant/message', {
        turn: 1,
        step: 1,
        usage: { inputTokens: 2_000_000, outputTokens: 0 },
      }),
    )
    expect(cost.uncachedInput.tokens).toBe(2_000_000)
    expect(cost.output.tokens).toBe(1_000_000)
    expect(cost.byWebSearch[0]?.output.tokens).toBe(1_000_000)
    expect(cost.byRoute.find(row => row.route === 'deepseek-v4-pro')?.uncachedInput.tokens).toBe(2_000_000)
  })

  it('sums two searches in the same turn onto the search-model cut', () => {
    const search = (callId: string) => event('tool/result', {
      turn: 2,
      step: 1,
      message: { source: { kind: 'tool', callId } },
      meta: attachSearchCost(
        { sources: [], truncated: false },
        { model: 'deepseek-v4-flash', inputTokens: 1_000_000, outputTokens: 0 },
      ),
    })
    const cost = fold(search('a'), search('b'))
    expect(cost.turns[2]?.uncachedInput).toBe(6)
    expect(cost.byWebSearch).toEqual([
      expect.objectContaining({
        route: 'deepseek-v4-flash',
        uncachedInput: { tokens: 2_000_000, cost: 6 },
        total: 6,
      }),
    ])
  })
})

describe('sessionCost historical price revisions', () => {
  it('prices the new deepseek-flash route at V4.1-Flash rates', () => {
    const cost = fold(
      event('request/context', { model: 'deepseek-flash' }, V41_PEAK),
      event('assistant/message', {
        turn: 1,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }, V41_PEAK),
    )

    expect(cost.total).toBe(2 + 8)
    expect(cost.byRoute).toEqual([
      expect.objectContaining({ route: 'deepseek-flash', total: 10 }),
    ])
  })

  it('keeps legacy Flash usage at its historical rate across the V4.1 cut', () => {
    const cost = fold(
      event('request/context', { model: 'deepseek-v4-flash' }, PEAK),
      event('assistant/message', {
        turn: 1,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }, PEAK),
      event('request/context', { model: 'deepseek-v4-flash' }, V41_PEAK),
      event('assistant/message', {
        turn: 2,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }, V41_PEAK),
    )

    expect(cost.total).toBe((3 + 9) + (2 + 8))
    expect(cost.bySchedule.peak.total).toBe(22)
  })

  it('routes Pro usage to V4.1-Flash rates after the announced cutoff', () => {
    const cost = fold(
      event('request/context', { model: 'deepseek-v4-pro' }, V41_PEAK),
      event('assistant/message', {
        turn: 1,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }, V41_PEAK),
      event('request/context', { model: 'deepseek-v4-pro' }, PRO_ROUTING_PEAK),
      event('assistant/message', {
        turn: 2,
        step: 1,
        usage: { inputTokens: 1_000_000, outputTokens: 1_000_000 },
      }, PRO_ROUTING_PEAK),
    )

    expect(cost.total).toBe((9 + 27) + (2 + 8))
    expect(cost.byRoute).toEqual([
      expect.objectContaining({ route: 'deepseek-v4-pro', total: 46 }),
    ])
  })
})
