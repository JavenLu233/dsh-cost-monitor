/**
 * CostDock: the session cost readout in the composer dock (the stats strip).
 * It reads the durable `sessionCost` projection (whole log, priced per request
 * by its time and model) and renders the total and bucket split, a global
 * eye toggle that shows/hides every turn's per-turn cost line, and a chart
 * button that opens the session cost stats dialog.
 */
import { memo, useEffect, useState } from 'react'
import type { UseProjection } from '@deepseek-ai/dsh-client-runtime/client'
import { Modal, Tooltip } from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: merges the sessionCost key into SessionProjectionMap for useProjection.
import type {} from '@javenlu233/dsh-session-cost/client'
import { ChartIcon } from './ChartIcon.tsx'
import { CostPanel } from './CostPanel.tsx'
import { formatCost } from './cost.ts'
import { HideEyeIcon, ShowEyeIcon } from './EyeIcon.tsx'
import type { NS } from './locales.ts'
import type { VisibilityStore } from './visibility.ts'
import css from './CostTail.module.css'
import panelCss from './CostPanel.module.css'

/** Registration-side shared visibility face. */
interface CostDockInjected {
  hooks: { visibility: VisibilityStore }
  setShowAll: (showAll: boolean) => void
}

/** Component props: the projection seat, the shared visibility face, and the locale seat. */
export type CostDockProps = { useProjection: UseProjection } & InjectFace<CostDockInjected> & PropsLocale<typeof NS>

/**
 * Render the session cost line, the show-all eye toggle, and the stats
 * dialog trigger, or nothing when the projection is absent or nothing has
 * billed a token.
 * @param props - the projection, shared visibility, and locale seats.
 * @returns the cost readout row, or null.
 */
export const CostDock = memo(function CostDock({ useProjection, useVisibility, setShowAll, t }: CostDockProps) {
  const cost = useProjection('sessionCost')
  // Must run on every render: a new session mounts this dock before any
  // usage, then the same instance receives the first sessionCost frame.
  const showAll = useVisibility(value => value.showAll)
  const [statsOpen, setStatsOpen] = useState(false)
  const visible = cost !== undefined && cost.total > 0
  useEffect(() => {
    if (!visible) setStatsOpen(false)
  }, [visible])
  if (!visible || cost === undefined) return null
  const miss = cost.uncachedInput.cost + cost.cacheWrite.cost
  const hit = cost.cacheRead.cost
  const output = cost.output.cost

  const parts = [t('cost.total', { cost: formatCost(cost.total, cost.currency) })]
  const breakdown: string[] = []
  if (miss > 0) breakdown.push(t('cost.miss', { cost: formatCost(miss, cost.currency) }))
  if (hit > 0) breakdown.push(t('cost.hit', { cost: formatCost(hit, cost.currency) }))
  if (output > 0) breakdown.push(t('cost.output', { cost: formatCost(output, cost.currency) }))
  if (breakdown.length > 0) parts.push(`（${breakdown.join(' · ')}）`)

  const eyeLabel = showAll ? t('cost.collapseAll') : t('cost.expandAll')
  const statsLabel = t('cost.stats')
  return (
    <div className={css.dock}>
      <div className={css.root} title={t('cost.note')}>
        {parts.join(' · ')}
      </div>
      <Tooltip label={eyeLabel} side="top">
        <button
          type="button"
          className={css.eye}
          aria-pressed={showAll}
          aria-label={eyeLabel}
          onClick={() => { setShowAll(!showAll) }}
        >
          {showAll ? <HideEyeIcon /> : <ShowEyeIcon />}
        </button>
      </Tooltip>
      <Tooltip label={statsLabel} side="top">
        <button
          type="button"
          className={css.eye}
          aria-pressed={statsOpen}
          aria-expanded={statsOpen}
          aria-label={statsLabel}
          onClick={() => { setStatsOpen(open => !open) }}
        >
          <ChartIcon />
        </button>
      </Tooltip>
      <Modal
        open={statsOpen}
        onClose={() => { setStatsOpen(false) }}
        title={statsLabel}
        closeLabel={t('cost.statsClose')}
        description={t('cost.note')}
        className={panelCss.dialog}
      >
        <CostPanel cost={cost} t={t} />
      </Modal>
    </div>
  )
})
