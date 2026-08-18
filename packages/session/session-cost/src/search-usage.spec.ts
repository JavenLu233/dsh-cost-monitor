import { describe, expect, it } from 'vitest'
import {
  attachIfPending,
  attachSearchCost,
  callIdFromToolResult,
  captureSearchFetch,
  isWebSearchMessagesBody,
  mapAnthropicUsage,
  SearchCostPending,
  searchCostFromMeta,
} from './search-usage.ts'

describe('mapAnthropicUsage', () => {
  it('maps Anthropic usage into disjoint TokenUsage buckets', () => {
    expect(mapAnthropicUsage({
      usage: {
        input_tokens: 10,
        output_tokens: 4,
        cache_read_input_tokens: 3,
        cache_creation_input_tokens: 2,
      },
    })).toEqual({
      inputTokens: 10,
      outputTokens: 4,
      cacheReadTokens: 3,
      cacheWriteTokens: 2,
    })
  })

  it('omits zero optional cache buckets', () => {
    expect(mapAnthropicUsage({ usage: { input_tokens: 8, output_tokens: 1 } }))
      .toEqual({ inputTokens: 8, outputTokens: 1 })
  })

  it('returns undefined when usage is absent or malformed', () => {
    expect(mapAnthropicUsage({})).toBeUndefined()
    expect(mapAnthropicUsage({ usage: { input_tokens: -1, output_tokens: 1 } })).toBeUndefined()
    expect(mapAnthropicUsage(null)).toBeUndefined()
  })
})

describe('isWebSearchMessagesBody', () => {
  it('accepts an Anthropic Messages body that carries the native web_search tool', () => {
    expect(isWebSearchMessagesBody({
      model: 'deepseek-v4-flash',
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    })).toBe(true)
  })

  it('rejects chat bodies and other tool lists', () => {
    expect(isWebSearchMessagesBody({ model: 'deepseek-v4-flash' })).toBe(false)
    expect(isWebSearchMessagesBody({
      model: 'deepseek-v4-flash',
      tools: [{ type: 'function', name: 'web_search' }],
    })).toBe(false)
  })
})

describe('search-cost meta', () => {
  it('attaches a sample without dropping existing search-card fields', () => {
    const meta = attachSearchCost(
      { sources: [{ url: 'https://a.test' }], truncated: false },
      { model: 'deepseek-v4-flash', inputTokens: 10, outputTokens: 2 },
    )
    expect(meta).toEqual({
      sources: [{ url: 'https://a.test' }],
      truncated: false,
      sessionCost: { model: 'deepseek-v4-flash', inputTokens: 10, outputTokens: 2 },
    })
  })

  it('reads a well-formed sample and ignores a search card without one', () => {
    expect(searchCostFromMeta({
      sessionCost: { model: 'deepseek-v4-flash', inputTokens: 10, outputTokens: 2 },
    })).toEqual({ model: 'deepseek-v4-flash', inputTokens: 10, outputTokens: 2 })
    expect(searchCostFromMeta({ sources: [], truncated: false })).toBeUndefined()
  })
})

describe('callIdFromToolResult', () => {
  it('reads the tool-result call id from the message source', () => {
    expect(callIdFromToolResult({
      turn: 1,
      step: 1,
      message: { source: { kind: 'tool', callId: 'call-9' } },
    })).toBe('call-9')
  })
})

describe('attachIfPending', () => {
  it('consumes a pending sample onto a matching tool/result', () => {
    const pending = new SearchCostPending()
    pending.remember('call-9', { model: 'deepseek-v4-flash', inputTokens: 5, outputTokens: 1 })
    const next = attachIfPending('tool/result', {
      turn: 1,
      step: 1,
      message: { source: { kind: 'tool', callId: 'call-9' } },
      meta: { sources: [], truncated: false },
    }, pending)
    expect(searchCostFromMeta((next as { meta: unknown }).meta)).toEqual({
      model: 'deepseek-v4-flash',
      inputTokens: 5,
      outputTokens: 1,
    })
    expect(pending.take('call-9')).toBeUndefined()
  })

  it('leaves unrelated events unchanged', () => {
    const pending = new SearchCostPending()
    pending.remember('call-9', { model: 'deepseek-v4-flash', inputTokens: 5, outputTokens: 1 })
    const data = { turn: 1 }
    expect(attachIfPending('assistant/message', data, pending)).toBe(data)
    expect(pending.take('call-9')).toEqual({
      model: 'deepseek-v4-flash',
      inputTokens: 5,
      outputTokens: 1,
    })
  })
})

describe('captureSearchFetch', () => {
  it('records usage from a cloned Messages response without consuming the original body', async () => {
    const payload = {
      content: [{ type: 'text', text: 'ok' }],
      usage: { input_tokens: 12, output_tokens: 3 },
    }
    const original = async (): Promise<Response> =>
      new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
    const captured: unknown[] = []
    const response = await captureSearchFetch(
      original,
      'https://api.deepseek.com/anthropic/v1/messages',
      {
        method: 'POST',
        body: JSON.stringify({
          model: 'deepseek-v4-flash',
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        }),
      },
      sample => captured.push(sample),
    )
    expect(captured).toEqual([{ model: 'deepseek-v4-flash', inputTokens: 12, outputTokens: 3 }])
    expect(await response.json()).toEqual(payload)
  })

  it('does not intercept fetches that are not a native web_search Messages call', async () => {
    const original = async (): Promise<Response> => new Response('{"ok":true}')
    const captured: unknown[] = []
    await captureSearchFetch(
      original,
      'https://api.deepseek.com/chat/completions',
      { method: 'POST', body: JSON.stringify({ model: 'deepseek-v4-pro' }) },
      sample => captured.push(sample),
    )
    expect(captured).toEqual([])
  })
})
