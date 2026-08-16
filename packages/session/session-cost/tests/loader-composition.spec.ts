/**
 * REAL-composition proof: the shipped YAML shape (session + projection
 * registry + session-cost) boots through the vendored Loader, the function
 * plugin's namespace survives (no default export), the schema defaults produce
 * a working config without a YAML config block, and a logged usage event serves
 * the `sessionCost` key through the composed registry.
 */

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { createMessage } from '@deepseek-ai/dsh-llm'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import * as SessionCostPlugin from '@javenlu233/dsh-session-cost'

let root: string | undefined
let context: Context | undefined

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  if (root !== undefined) await rm(root, { recursive: true, force: true })
  root = undefined
})

async function loadYaml(lines: readonly string[]): Promise<Context> {
  root = await mkdtemp(join(tmpdir(), 'dsh-session-cost-loader-'))
  const configPath = join(root, 'cordis.yml')
  await writeFile(configPath, [...lines, ''].join('\n'))

  context = new Context()
  context.baseUrl = pathToFileURL(root).href + '/'
  await context.plugin(Loader)
  context.loader.builtins.include = Include
  const modules = new Map<string, unknown>([
    ['@deepseek-ai/dsh-session', SessionStore],
    ['@deepseek-ai/dsh-session-projection', SessionProjectionRegistry],
    ['@javenlu233/dsh-session-cost', SessionCostPlugin],
  ])
  context.loader.internal = {
    version: 'v2',
    async import(specifier: string) {
      if (!modules.has(specifier)) throw new Error(`unexpected Loader import: ${specifier}`)
      return modules.get(specifier)
    },
  } as unknown as NonNullable<typeof context.loader.internal>
  await context.loader.create({
    name: 'cordis:include',
    config: { path: pathToFileURL(configPath).href },
  })
  await context.loader.await()
  return context
}

const message = createMessage({
  role: 'assistant',
  content: [{ type: 'text', text: 'answer' }],
  source: { kind: 'model', provider: 'deepseek', model: 'deepseek-v4-flash' },
})

describe('real Loader composition', () => {
  it('loads the shipped session-cost YAML shape and serves whole-log cost from schema defaults', async () => {
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: '@javenlu233/dsh-session-cost'",
    ])

    const unloaded = [...loaded.loader.entries()]
      .filter(entry => entry.fiber === undefined && !entry.disabled)
      .map(entry => entry.options.name)
    expect(unloaded).toEqual([])

    const session = loaded.sessions.create(SessionId('composed'))
    session.append('request/context', { provider: 'deepseek', model: 'deepseek-v4-flash' })
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message,
      usage: { inputTokens: 1_000_000, outputTokens: 1_000_000, cacheReadTokens: 1_000_000 },
    }, { surfaceOp: 'append', sourceEventSeqs: [] })
    const value = loaded.sessionProjections.snapshot(session).values.sessionCost as {
      currency: string
      total: number
      billedInputTokens: number
    }
    expect(value.currency).toBe('CNY')
    expect(value.billedInputTokens).toBe(2_000_000)
    expect(value.total).toBeGreaterThan(0)
  })

  it('honours a YAML config override', async () => {
    const loaded = await loadYaml([
      "- name: '@deepseek-ai/dsh-session'",
      "- name: '@deepseek-ai/dsh-session-projection'",
      "- name: '@javenlu233/dsh-session-cost'",
      '  config:',
      '    currency: USD',
    ])
    const session = loaded.sessions.create(SessionId('overridden'))
    session.append('assistant/message', {
      turn: 1,
      step: 1,
      message,
      usage: { inputTokens: 1, outputTokens: 0 },
    }, { surfaceOp: 'append', sourceEventSeqs: [] })
    const value = loaded.sessionProjections.snapshot(session).values.sessionCost as { currency: string }
    expect(value.currency).toBe('USD')
  })

  it('keeps the function-plugin namespace free of a default export', () => {
    expect('default' in SessionCostPlugin).toBe(false)
  })
})
