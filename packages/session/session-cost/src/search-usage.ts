/**
 * Capture helpers for the auxiliary DeepSeek web_search Messages call.
 * Pure: no cordis, no session types. The plugin wires these into fetch and
 * `session.append` so a `tool/result` can carry the provider usage that the
 * harness otherwise discards.
 *
 * @module @javenlu233/dsh-session-cost/search-usage
 */

/** Opaque meta key on `tool/result`; search-card readers ignore unknown fields. */
export const SEARCH_COST_META_KEY = 'sessionCost'

/** Provider-reported usage of one auxiliary search model call. */
export interface SearchCostSample {
  /** Anthropic-format model id billed for the search call. */
  model: string
  /** Uncached (cache-miss) input tokens. */
  inputTokens: number
  /** Output tokens. */
  outputTokens: number
  /** Cache-read input tokens, when the provider reported any. */
  cacheReadTokens?: number
  /** Cache-write input tokens, when the provider reported any. */
  cacheWriteTokens?: number
}

/** True for a non-negative integer JSON number. */
function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0
}

/**
 * Map an Anthropic Messages JSON body to disjoint token buckets.
 * @param payload - the parsed response (or any other JSON).
 * @returns the usage sample, or undefined when the envelope is unusable.
 */
export function mapAnthropicUsage(payload: unknown): Omit<SearchCostSample, 'model'> | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const usage = (payload as { usage?: unknown }).usage
  if (typeof usage !== 'object' || usage === null) return undefined
  const record = usage as Record<string, unknown>
  if (!isCount(record.input_tokens) || !isCount(record.output_tokens)) return undefined
  const cacheRead = isCount(record.cache_read_input_tokens) ? record.cache_read_input_tokens : 0
  const cacheWrite = isCount(record.cache_creation_input_tokens) ? record.cache_creation_input_tokens : 0
  return {
    inputTokens: record.input_tokens,
    outputTokens: record.output_tokens,
    ...cacheRead > 0 ? { cacheReadTokens: cacheRead } : {},
    ...cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {},
  }
}

/**
 * True when `body` is an Anthropic Messages request carrying native web_search.
 * @param body - parsed JSON request body.
 */
export function isWebSearchMessagesBody(body: unknown): body is { model: string } {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false
  const record = body as Record<string, unknown>
  if (typeof record.model !== 'string' || record.model.length === 0) return false
  if (!Array.isArray(record.tools)) return false
  return record.tools.some(tool =>
    typeof tool === 'object' && tool !== null && (tool as { type?: unknown }).type === 'web_search_20250305')
}

/**
 * Attach a search-cost sample onto opaque tool-result meta.
 * @param meta - existing `tool/result` meta, if any.
 * @param sample - the captured search usage.
 */
export function attachSearchCost(meta: unknown, sample: SearchCostSample): Record<string, unknown> {
  const base = typeof meta === 'object' && meta !== null && !Array.isArray(meta)
    ? { ...(meta as Record<string, unknown>) }
    : {}
  return { ...base, [SEARCH_COST_META_KEY]: sample }
}

/**
 * Read a search-cost sample from opaque tool-result meta.
 * @param meta - `tool/result` meta.
 */
export function searchCostFromMeta(meta: unknown): SearchCostSample | undefined {
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) return undefined
  const sample = (meta as Record<string, unknown>)[SEARCH_COST_META_KEY]
  if (typeof sample !== 'object' || sample === null || Array.isArray(sample)) return undefined
  const record = sample as Record<string, unknown>
  if (typeof record.model !== 'string' || record.model.length === 0) return undefined
  if (!isCount(record.inputTokens) || !isCount(record.outputTokens)) return undefined
  const cacheRead = isCount(record.cacheReadTokens) ? record.cacheReadTokens : 0
  const cacheWrite = isCount(record.cacheWriteTokens) ? record.cacheWriteTokens : 0
  return {
    model: record.model,
    inputTokens: record.inputTokens,
    outputTokens: record.outputTokens,
    ...cacheRead > 0 ? { cacheReadTokens: cacheRead } : {},
    ...cacheWrite > 0 ? { cacheWriteTokens: cacheWrite } : {},
  }
}

/**
 * Read the tool-result call id used to pair a pending fetch capture.
 * @param data - `tool/result` event data.
 */
export function callIdFromToolResult(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const message = (data as { message?: unknown }).message
  if (typeof message !== 'object' || message === null) return undefined
  const source = (message as { source?: unknown }).source
  if (typeof source === 'object' && source !== null) {
    const record = source as { kind?: unknown; callId?: unknown }
    if (record.kind === 'tool' && typeof record.callId === 'string' && record.callId.length > 0) {
      return record.callId
    }
  }
  const content = (message as { content?: unknown }).content
  const first = Array.isArray(content) ? content[0] : undefined
  if (typeof first === 'object' && first !== null) {
    const id = (first as { toolCallId?: unknown }).toolCallId
    if (typeof id === 'string' && id.length > 0) return id
  }
  return undefined
}

/** In-flight search usage keyed by the wrapping `web_search` call id. */
export class SearchCostPending {
  private readonly samples = new Map<string, SearchCostSample>()

  /**
   * Remember one captured sample until its `tool/result` is appended.
   * @param callId - the wrapping tool call id.
   * @param sample - the captured search usage.
   */
  remember(callId: string, sample: SearchCostSample): void {
    this.samples.set(callId, sample)
  }

  /**
   * Take and forget the sample for `callId`, if any.
   * @param callId - the wrapping tool call id.
   */
  take(callId: string): SearchCostSample | undefined {
    const sample = this.samples.get(callId)
    if (sample === undefined) return undefined
    this.samples.delete(callId)
    return sample
  }
}

/**
 * Merge a pending search-cost sample onto a `tool/result` payload.
 * @param type - the session event type being appended.
 * @param data - the event payload.
 * @param pending - in-flight samples keyed by call id.
 * @returns the original data, or a shallow copy with `meta.sessionCost`.
 */
export function attachIfPending(type: string, data: unknown, pending: SearchCostPending): unknown {
  if (type !== 'tool/result') return data
  const callId = callIdFromToolResult(data)
  if (callId === undefined) return data
  const sample = pending.take(callId)
  if (sample === undefined || typeof data !== 'object' || data === null) return data
  const record = data as { meta?: unknown }
  return { ...record, meta: attachSearchCost(record.meta, sample) }
}

/** Parse a fetch `body` init into JSON when it is a string. */
function jsonBody(body: unknown): unknown {
  if (typeof body !== 'string') return undefined
  try {
    return JSON.parse(body) as unknown
  } catch {
    return undefined
  }
}

/**
 * Run one fetch, and when it is a native web_search Messages call, report the
 * response usage through `onCaptured` before returning the original response.
 * @param original - the real `fetch`.
 * @param input - fetch input.
 * @param init - fetch init.
 * @param onCaptured - called with the parsed search usage, if any.
 */
export async function captureSearchFetch(
  original: typeof fetch,
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  onCaptured: (sample: SearchCostSample) => void,
): Promise<Response> {
  const body = jsonBody(init?.body)
  if (!isWebSearchMessagesBody(body)) return original(input, init)
  const response = await original(input, init)
  try {
    const payload: unknown = await response.clone().json()
    const usage = mapAnthropicUsage(payload)
    if (usage !== undefined) onCaptured({ model: body.model, ...usage })
  } catch {
    // A non-JSON body still belongs to the original consumer; skip capture.
  }
  return response
}
