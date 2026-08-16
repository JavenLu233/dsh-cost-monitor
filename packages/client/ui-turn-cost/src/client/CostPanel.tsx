/**
 * Session cost stats body: composition donut, per-turn trend, cache-savings
 * line, a per-model cut (always shown — a session may switch models), and a
 * schedule cut when more than one price window billed.
 * Priced host-side; this file only charts the `sessionCost` cuts.
 *
 * @author linqiya.1
 * @date 2026-08-16 19:45
 */
import type { PriceSchedule, SessionCostProjection } from '@javenlu233/dsh-session-cost/client'
import { CompositionChart, SliceBarList, TrendChart } from './CostCharts.tsx'
import { formatCost } from './cost.ts'
import type { TurnCostKey } from './locales.ts'
import css from './CostPanel.module.css'

/** Locale interpolator owned by the turn-cost dictionaries. */
type Translate = (key: TurnCostKey, params?: Record<string, unknown>) => string

const SCHEDULES: readonly PriceSchedule[] = ['flat', 'peak', 'offPeak']

const SCHEDULE_KEY: Record<PriceSchedule, TurnCostKey> = {
  flat: 'cost.schedule.flat',
  peak: 'cost.schedule.peak',
  offPeak: 'cost.schedule.offPeak',
}

/** Props: the current sessionCost frame and the dock's locale interpolator. */
export interface CostPanelProps {
  cost: SessionCostProjection
  t: Translate
}

/**
 * Render the stats dialog body for one sessionCost frame.
 * @param props - the priced projection and locale interpolator.
 */
export function CostPanel({ cost, t }: CostPanelProps) {
  const series = cost.series ?? []
  const byRoute = cost.byRoute ?? []
  const bySchedule = cost.bySchedule
  const usedSchedules = bySchedule === undefined
    ? []
    : SCHEDULES.filter(schedule => bySchedule[schedule].total > 0)
  const cacheSaved = cost.cacheSaved ?? 0
  return (
    <div className={css.body}>
      <section className={css.section}>
        <h3 className={css.title}>{t('cost.composition')}</h3>
        <CompositionChart
          slice={{
            uncachedInput: cost.uncachedInput,
            cacheRead: cost.cacheRead,
            cacheWrite: cost.cacheWrite,
            output: cost.output,
            total: cost.total,
          }}
          currency={cost.currency}
          t={t}
        />
        {cacheSaved > 0 && (
          <p className={css.savings}>
            {t('cost.cacheSaved', { cost: formatCost(cacheSaved, cost.currency) })}
            {' · '}
            {t('cost.ifAllMiss', { cost: formatCost(cost.total + cacheSaved, cost.currency) })}
          </p>
        )}
      </section>
      {series.length > 0 && (
        <section className={css.section}>
          <h3 className={css.title}>{t('cost.trend')}</h3>
          <TrendChart series={series} currency={cost.currency} t={t} />
        </section>
      )}
      {byRoute.length > 0 && (
        <section className={css.section}>
          <h3 className={css.title}>{t('cost.byRoute')}</h3>
          <SliceBarList
            rows={byRoute.map(row => ({ key: row.route, label: row.route, slice: row }))}
            currency={cost.currency}
            t={t}
          />
        </section>
      )}
      {usedSchedules.length > 1 && bySchedule !== undefined && (
        <section className={css.section}>
          <h3 className={css.title}>{t('cost.bySchedule')}</h3>
          <SliceBarList
            rows={usedSchedules.map(schedule => ({
              key: schedule,
              label: t(SCHEDULE_KEY[schedule]),
              slice: bySchedule[schedule],
            }))}
            currency={cost.currency}
            t={t}
          />
        </section>
      )}
    </div>
  )
}
