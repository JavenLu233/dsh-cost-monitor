/**
 * Host-side capture of the auxiliary DeepSeek web_search Messages call.
 * Wraps `tools/execute` (ALS by call id), `fetch` (usage from the JSON body),
 * and `session.append` (pending sample onto `tool/result.meta`) so the
 * sessionCost fold can price search tokens without a harness event.
 *
 * @module @javenlu233/dsh-session-cost/capture
 * @author linqiya.1
 * @date 2026-08-18 22:57
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-session'
import type {} from '@deepseek-ai/dsh-tools'
import { attachIfPending, captureSearchFetch, SearchCostPending } from './search-usage.ts'

/** Call id of the `web_search` tool execution wrapping the current fetch. */
const searchCall = new AsyncLocalStorage<{ callId: string }>()

/**
 * Install the search-cost capture on this plugin fiber. Unload restores fetch.
 * @param ctx - plugin context; `tools` and `session/created` are optional
 *   (compositions without them keep the fold, which still reads already-logged meta).
 */
export function installSearchCostCapture(ctx: Context): void {
  const pending = new SearchCostPending()
  const originalFetch = globalThis.fetch.bind(globalThis)
  ctx.effect(() => {
    globalThis.fetch = (input, init) => {
      const store = searchCall.getStore()
      if (store === undefined) return originalFetch(input, init)
      return captureSearchFetch(originalFetch, input, init, sample => {
        pending.remember(store.callId, sample)
      })
    }
    return () => {
      globalThis.fetch = originalFetch
    }
  }, 'session-cost: search fetch')

  ctx.inject(['tools'], (toolsCtx) => {
    toolsCtx.on('tools/execute', (exec, next) => {
      if (exec.name !== 'web_search') return next()
      return searchCall.run({ callId: String(exec.callId) }, () => next())
    })
  })

  ctx.on('session/created', (session) => {
    const original = session.append.bind(session) as (...args: unknown[]) => unknown
    session.append = ((type: string, data: unknown, ...rest: unknown[]) =>
      original(type, attachIfPending(type, data, pending), ...rest)) as typeof session.append
  })
}
