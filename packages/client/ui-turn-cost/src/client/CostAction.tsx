/**
 * CostAction: a "费用" toggle in the assistant-message action strip. Hovering
 * shows this turn's cost (priced host-side by the `sessionCost` projection, with
 * its miss / hit / output split) as a tooltip; clicking toggles this message's
 * line. The shared visibility store has no priority between the global show-all
 * and per-message toggles — the last write wins. Multi-entry (list), so it
 * coexists with the produced-files row.
 */
import { memo, useMemo } from 'react'
import type { AssistantMessageNode } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: brings the 'conversation.chat.assistant-actions' SlotMap row into
// this program so PropsRuntime can type the owner share.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges the sessionCost key into SessionProjectionMap for useProjection.
import type { SessionCostProjection } from '@javenlu233/dsh-session-cost/client'
import { formatCost } from './cost.ts'
import { CostIcon } from './CostIcon.tsx'
import type { NS } from './locales.ts'
import type { VisibilityStore } from './visibility.ts'
import css from './CostTail.module.css'

/** Registration-side shared visibility face. */
interface CostActionInjected {
  hooks: { visibility: VisibilityStore }
  toggleMessage: (messageId: string) => void
}

/** Component props: the assistant-actions runtime share, the shared visibility face, and the locale seat. */
export type CostActionProps = PropsRuntime<'conversation.chat.assistant-actions'> & InjectFace<CostActionInjected> & PropsLocale<typeof NS>

/**
 * Render the "费用" toggle, or nothing when the message's turn has no billed usage.
 * @param props - the addressed message identity, session kit, shared visibility, and locale seat.
 * @returns the hover/toggle cost control, or null.
 */
export const CostAction = memo(function CostAction({
  messageId,
  useSession,
  useProjection,
  useVisibility,
  toggleMessage,
  t,
}: CostActionProps) {
  const nodes = useSession(snapshot => snapshot.chat.legacy.nodes)
  const shown = useVisibility(value => value.overrides[String(messageId)] ?? value.showAll)
  const cost = useProjection('sessionCost')

  const turn = useMemo(() => {
    const node = nodes.find((n): n is AssistantMessageNode => n.kind === 'assistant' && n.messageId === messageId)
    return node?.turn
  }, [nodes, messageId])

  if (cost === undefined) return null
  // A host still on the pre-`turns` projection shape has no per-turn split; read
  // through an optional shape so a missing table hides the button, not throws.
  const turns = (cost as unknown as { turns?: SessionCostProjection['turns'] }).turns
  if (turn === undefined || turns === undefined) return null
  const turnCost = turns[turn]
  if (turnCost === undefined) return null
  const total = turnCost.uncachedInput + turnCost.cacheRead + turnCost.cacheWrite + turnCost.output
  if (total <= 0) return null

  const currency = cost.currency
  const miss = turnCost.uncachedInput + turnCost.cacheWrite
  const hit = turnCost.cacheRead
  const output = turnCost.output
  const breakdown: string[] = []
  if (miss > 0) breakdown.push(t('cost.miss', { cost: formatCost(miss, currency) }))
  if (hit > 0) breakdown.push(t('cost.hit', { cost: formatCost(hit, currency) }))
  if (output > 0) breakdown.push(t('cost.output', { cost: formatCost(output, currency) }))
  const line = `${t('cost.turn', { cost: formatCost(total, currency) })}${breakdown.length > 0 ? ` （${breakdown.join(' · ')}）` : ''}`

  return (
    <>
      <Tooltip label={`${line} · ${t('cost.toggleHint')}`} side="bottom">
        <button
          type="button"
          className={css.action}
          aria-pressed={shown}
          aria-label={t('cost.label')}
          onClick={() => { toggleMessage(String(messageId)) }}
        >
          <CostIcon />
        </button>
      </Tooltip>
      {shown && <span className={css.turn}>{line}</span>}
    </>
  )
})
