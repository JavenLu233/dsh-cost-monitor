// @vitest-environment jsdom
/**
 * CostDock must keep a stable hook order across the empty → billed
 * transition: a new session mounts the dock before any usage lands, then
 * the same instance receives the first `sessionCost` frame. Calling
 * useVisibility only after total > 0 throws (and the slot error boundary
 * swallows the row — per-turn buttons still work because they mount later).
 */
import { act, useSyncExternalStore } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SessionCostProjection } from '@javenlu233/dsh-session-cost/client'
import { zh } from '../src/client/locales.ts'

vi.mock('../src/client/CostTail.module.css', () => ({
  default: { dock: 'dock', root: 'root', eye: 'eye' },
}))
vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Tooltip: ({ children }: { children: unknown }) => children,
}))

const { CostDock } = await import('../src/client/CostDock.tsx')

const BILLED: SessionCostProjection = {
  currency: 'CNY',
  total: 0.05,
  billedInputTokens: 1_000,
  cacheHitPercent: 0,
  uncachedInput: { tokens: 1_000, cost: 0.02 },
  cacheRead: { tokens: 0, cost: 0 },
  cacheWrite: { tokens: 0, cost: 0 },
  output: { tokens: 100, cost: 0.03 },
  turns: { 1: { uncachedInput: 0.02, cacheRead: 0, cacheWrite: 0, output: 0.03 } },
}

describe('CostDock empty-to-billed', () => {
  let host: HTMLDivElement | undefined
  let root: Root | undefined

  afterEach(() => {
    act(() => { root?.unmount() })
    host?.remove()
    host = undefined
    root = undefined
  })

  it('renders the session total after the first usage frame on a new session', () => {
    host = document.createElement('div')
    document.body.appendChild(host)
    root = createRoot(host)
    const visibility = { showAll: false, overrides: {} }
    let cost: SessionCostProjection | undefined
    const t = (key: keyof typeof zh, params?: Record<string, string>) =>
      params === undefined ? zh[key] : zh[key].replace('{cost}', params.cost)
    const useProjection = ((key: string) => useSyncExternalStore(
      () => () => {},
      () => key === 'sessionCost' ? cost : undefined,
    )) as never
    const useVisibility = ((selector: (value: typeof visibility) => unknown) => useSyncExternalStore(
      () => () => {},
      () => selector(visibility),
    )) as never
    const renderDock = () => {
      root!.render(
        <CostDock
          useProjection={useProjection}
          useVisibility={useVisibility}
          setShowAll={() => {}}
          t={t as never}
        />,
      )
    }

    act(() => { renderDock() })
    expect(host.textContent).toBe('')

    cost = BILLED
    act(() => { renderDock() })
    expect(host.textContent).toContain('累计费用 ¥0.05')
  })
})
