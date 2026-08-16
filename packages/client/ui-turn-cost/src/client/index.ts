/**
 * Inline cost plugin, browser half: the session total readout (plus a global
 * expand-all eye toggle and a stats dialog) in the composer dock, and a
 * per-turn cost toggle in the assistant-message action strip. Both are
 * list-slot entries, so they coexist with the produced-files row and the
 * stats line; composing this plugin out removes both.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the 'conversation.composer.dock' and 'conversation.chat.assistant-actions'
// SlotMap rows (declared by the owning package) must be in the program to type.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { CostAction } from './CostAction.tsx'
import { CostDock } from './CostDock.tsx'
import { en, NS, zh } from './locales.ts'
import { createVisibilityStore } from './visibility.ts'

/** Required services: the two slot registrations and their dictionaries. */
export const inject = ['slots', 'locale']

/**
 * Client plugin body: register the dictionaries, the shared visibility store,
 * and both cost entries.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-turn-cost: dictionaries')
  const { store: visibility, setShowAll, toggleMessage } = createVisibilityStore()
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'cost',
    order: 10,
    locale: NS,
    inject: () => ({
      hooks: { visibility },
      setShowAll,
    }),
  }, CostDock))
  ctx.slots.inject('conversation.chat.assistant-actions', () => ctx.slots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'cost',
    order: 0,
    locale: NS,
    inject: () => ({
      hooks: { visibility },
      toggleMessage,
    }),
  }, CostAction))
}
