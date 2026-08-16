/**
 * SVG charts for the session cost stats panel: a composition donut and a
 * per-turn stacked-bar + cumulative-line trend. No chart library; fills use
 * the panel's `--cost-*` CSS variables.
 *
 * @author linqiya.1
 * @date 2026-08-16 19:45
 */
import { useMemo, useState } from 'react'
import type { CostSlice, TurnCostSlice } from '@javenlu233/dsh-session-cost/client'
import { formatCost, formatTokens, sharePercent } from './cost.ts'
import type { TurnCostKey } from './locales.ts'
import css from './CostPanel.module.css'

/** Locale interpolator owned by the turn-cost dictionaries. */
type Translate = (key: TurnCostKey, params?: Record<string, unknown>) => string

/** One billed bucket plotted on the donut and stacked bars. */
export const CHART_BUCKETS = [
  { key: 'uncachedInput', color: 'var(--cost-uncached)', labelKey: 'cost.bucket.uncached' },
  { key: 'cacheRead', color: 'var(--cost-hit)', labelKey: 'cost.bucket.hit' },
  { key: 'cacheWrite', color: 'var(--cost-write)', labelKey: 'cost.bucket.write' },
  { key: 'output', color: 'var(--cost-output)', labelKey: 'cost.bucket.output' },
] as const

/** Format `{percent}%` from a part/whole pair. */
function share(t: Translate, part: number, whole: number): string {
  return t('cost.share', { percent: sharePercent(part, whole) })
}

/** Props for the four-bucket token/cost/share table. */
interface BucketRowsProps {
  slice: CostSlice
  currency: string
  t: Translate
}

/**
 * Render one aligned row per billed bucket: swatch, name, tokens, cost, share.
 * @param props - the priced slice, currency, and locale interpolator.
 */
function BucketRows({ slice, currency, t }: BucketRowsProps) {
  const rows = CHART_BUCKETS
    .map(bucket => ({ ...bucket, part: slice[bucket.key] }))
    .filter(row => row.part.tokens > 0 || row.part.cost > 0)
  return (
    <ul className={css.bucketList}>
      {rows.map(row => (
        <li key={row.key} className={css.bucketRow}>
          <span className={css.swatch} style={{ background: row.color }} />
          <span className={css.label}>{t(row.labelKey)}</span>
          <span className={css.muted}>{t('cost.tokens', { tokens: formatTokens(row.part.tokens) })}</span>
          <span className={css.metric}>{formatCost(row.part.cost, currency)}</span>
          <span className={css.shareCell}>{share(t, row.part.cost, slice.total)}</span>
        </li>
      ))}
    </ul>
  )
}

/** Props for the hover/detail card of one priced cut. */
interface SliceDetailCardProps {
  title: string
  slice: CostSlice
  currency: string
  t: Translate
  whole: number
  footer?: { label: string; value: number; whole: number }
}

/**
 * Render a titled cost card: share, total, bucket table, optional footer.
 * @param props - the cut to describe and its share of `whole`.
 */
function SliceDetailCard({ title, slice, currency, t, whole, footer }: SliceDetailCardProps) {
  return (
    <div className={css.card}>
      <div className={css.cardHead}>
        <span className={css.cardTitle}>{title}</span>
        <span className={css.cardShare}>{share(t, slice.total, whole)}</span>
      </div>
      <div className={css.cardTotal}>{formatCost(slice.total, currency)}</div>
      <BucketRows slice={slice} currency={currency} t={t} />
      {footer !== undefined && (
        <div className={css.cardFoot}>
          <span>{footer.label}</span>
          <span className={css.metric}>{formatCost(footer.value, currency)}</span>
          <span className={css.shareCell}>{share(t, footer.value, footer.whole)}</span>
        </div>
      )}
    </div>
  )
}

/** Props for the four-bucket composition donut and legend. */
export interface CompositionChartProps {
  slice: CostSlice
  currency: string
  t: Translate
}

/**
 * Render a donut of the four billing buckets plus a token/cost legend.
 * @param props - the priced slice, currency, and locale interpolator.
 */
export function CompositionChart({ slice, currency, t }: CompositionChartProps) {
  const total = slice.total
  const radius = 36
  const circ = 2 * Math.PI * radius
  let offset = 0
  const rows = CHART_BUCKETS
    .map(bucket => ({ ...bucket, part: slice[bucket.key] }))
    .filter(row => row.part.tokens > 0 || row.part.cost > 0)
  return (
    <div className={css.composition}>
      <svg className={css.donut} viewBox="0 0 100 100" aria-hidden="true">
        {total <= 0 || rows.length === 0
          ? (
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="14" opacity="0.15" />
          )
          : rows.map(row => {
            const length = row.part.cost / total * circ
            const node = (
              <circle
                key={row.key}
                cx="50"
                cy="50"
                r={radius}
                fill="none"
                stroke={row.color}
                strokeWidth="14"
                strokeDasharray={`${length} ${circ - length}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 50 50)"
              />
            )
            offset += length
            return node
          })}
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" className={css.donutCenter}>
          {formatCost(total, currency)}
        </text>
      </svg>
      <BucketRows slice={slice} currency={currency} t={t} />
    </div>
  )
}

/** Props for the per-turn stacked cost bars with a cumulative overlay. */
export interface TrendChartProps {
  series: TurnCostSlice[]
  currency: string
  t: Translate
}

/**
 * Render stacked per-turn cost bars (scaled to the most expensive turn) and a
 * cumulative line (scaled to the session total). Hovering a column fills a
 * detail card under the chart — not a cramped tooltip string.
 * @param props - the turn series, currency, and locale interpolator.
 */
export function TrendChart({ series, currency, t }: TrendChartProps) {
  const [hovered, setHovered] = useState<number | null>(null)
  const points = useMemo(() => {
    let cumulative = 0
    return series.map(row => {
      cumulative += row.total
      return { row, cumulative }
    })
  }, [series])
  if (points.length === 0) return null
  const barMax = Math.max(...points.map(point => point.row.total), 0)
  const lineMax = Math.max(...points.map(point => point.cumulative), 0)
  const plotLeft = 64
  const plotRight = 64
  const plotTop = 20
  const plotBottom = 148
  const plotHeight = plotBottom - plotTop
  const slot = Math.max(28, Math.min(56, 360 / points.length))
  const plotWidth = Math.max(320, points.length * slot)
  const width = plotLeft + plotWidth + plotRight
  const yBar = (value: number) => plotBottom - (barMax <= 0 ? 0 : value / barMax * plotHeight)
  const yLine = (value: number) => plotBottom - (lineMax <= 0 ? 0 : value / lineMax * plotHeight)
  const barTicks = [0, 0.5, 1].map(fraction => barMax * fraction)
  const lineTicks = [0, 0.5, 1].map(fraction => lineMax * fraction)
  const line = points
    .map((point, index) => `${plotLeft + index * slot + slot / 2},${yLine(point.cumulative)}`)
    .join(' ')
  const hover = hovered === null ? undefined : points[hovered]
  return (
    <>
      <div className={css.trendWrap}>
        <div className={css.trendPlot} style={{ width }}>
          <svg
            className={css.trend}
            viewBox={`0 0 ${width} 168`}
            width={width}
            role="img"
            aria-label={t('cost.trend')}
          >
            {barTicks.map((tick, index) => (
              <g key={`bar-${index}`}>
                <line className={css.grid} x1={plotLeft} x2={width - plotRight} y1={yBar(tick)} y2={yBar(tick)} />
                <text className={css.axis} x={plotLeft - 6} y={yBar(tick) + 3} textAnchor="end">
                  {formatCost(tick, currency)}
                </text>
              </g>
            ))}
            {lineTicks.map((tick, index) => (
              <text
                key={`line-${index}`}
                className={css.axis}
                x={width - plotRight + 6}
                y={yLine(tick) + 3}
                textAnchor="start"
              >
                {formatCost(tick, currency)}
              </text>
            ))}
            {points.map((point, index) => {
              const x = plotLeft + index * slot
              const barWidth = Math.max(6, slot - 10)
              const barX = x + (slot - barWidth) / 2
              let y = plotBottom
              const stacks = CHART_BUCKETS.map(bucket => {
                const cost = point.row[bucket.key].cost
                const height = barMax <= 0 ? 0 : cost / barMax * plotHeight
                y -= height
                return { ...bucket, y, height }
              })
              return (
                <g key={point.row.turn}>
                  {hovered === index && (
                    <rect className={css.hover} x={x} y={plotTop} width={slot} height={plotHeight} />
                  )}
                  {stacks.filter(stack => stack.height > 0).map(stack => (
                    <rect
                      key={stack.key}
                      x={barX}
                      y={stack.y}
                      width={barWidth}
                      height={stack.height}
                      fill={stack.color}
                      rx={1}
                    />
                  ))}
                  {point.row.total > 0 && lineMax > 0 && (
                    <text
                      className={css.barShare}
                      x={x + slot / 2}
                      y={Math.max(12, yBar(point.row.total) - 4)}
                      textAnchor="middle"
                    >
                      {share(t, point.row.total, lineMax)}
                    </text>
                  )}
                  <text className={css.axis} x={x + slot / 2} y={162} textAnchor="middle">
                    {point.row.turn}
                  </text>
                </g>
              )
            })}
            <polyline
              fill="none"
              stroke="var(--cost-line)"
              strokeWidth="1.5"
              points={line}
            />
            {points.map((point, index) => (
              <circle
                key={point.row.turn}
                cx={plotLeft + index * slot + slot / 2}
                cy={yLine(point.cumulative)}
                r="2.5"
                fill="var(--cost-line)"
              />
            ))}
          </svg>
          {points.map((point, index) => {
            const heading = [
              t('cost.turnIndex', { turn: String(point.row.turn) }),
              formatCost(point.row.total, currency),
              share(t, point.row.total, lineMax),
            ].join(' ')
            return (
              <button
                key={point.row.turn}
                type="button"
                className={css.trendHit}
                style={{
                  left: plotLeft + index * slot,
                  width: slot,
                  top: plotTop,
                  height: plotHeight,
                }}
                aria-label={heading}
                onMouseEnter={() => { setHovered(index) }}
                onMouseLeave={() => { setHovered(null) }}
                onFocus={() => { setHovered(index) }}
                onBlur={() => { setHovered(null) }}
              />
            )
          })}
        </div>
      </div>
      {hover === undefined
        ? <p className={css.detail}>{t('cost.trendHint')}</p>
        : (
          <SliceDetailCard
            title={t('cost.turnIndex', { turn: String(hover.row.turn) })}
            slice={hover.row}
            currency={currency}
            t={t}
            whole={lineMax}
            footer={{
              label: t('cost.cumulativeLabel'),
              value: hover.cumulative,
              whole: lineMax,
            }}
          />
        )}
    </>
  )
}

/** Props for a labeled stack of horizontal slice bars (model or schedule). */
export interface SliceBarListProps {
  rows: Array<{ key: string; label: string; slice: CostSlice }>
  currency: string
  t: Translate
}

/**
 * Render horizontal stacked bars for a small set of named cuts. Each row
 * shows cost and share, with the bucket table always open underneath.
 * @param props - labeled slices, currency, and locale interpolator.
 */
export function SliceBarList({ rows, currency, t }: SliceBarListProps) {
  const max = Math.max(...rows.map(row => row.slice.total), 0)
  const whole = rows.reduce((sum, row) => sum + row.slice.total, 0)
  return (
    <div className={css.bars}>
      {rows.map(row => (
        <div key={row.key} className={css.barBlock}>
          <span className={css.label} title={row.label}>{row.label}</span>
          <div className={css.track}>
            {CHART_BUCKETS.map(bucket => {
              const cost = row.slice[bucket.key].cost
              if (cost <= 0 || max <= 0) return null
              return (
                <span
                  key={bucket.key}
                  className={css.seg}
                  style={{ width: `${cost / max * 100}%`, background: bucket.color }}
                />
              )
            })}
          </div>
          <span className={css.metricStack}>
            <span className={css.metric}>{formatCost(row.slice.total, currency)}</span>
            <span className={css.metricShare}>{share(t, row.slice.total, whole)}</span>
          </span>
          <div className={css.barDetail}>
            <BucketRows slice={row.slice} currency={currency} t={t} />
          </div>
        </div>
      ))}
    </div>
  )
}
