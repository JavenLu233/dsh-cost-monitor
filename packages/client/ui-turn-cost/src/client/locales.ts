/** `turnCost` namespace dictionaries (inline turn-tail cost readout). */

/** Dictionary namespace owned by this plugin. */
export const NS = 'turnCost'

/** The turn-cost dictionary key set (the source of truth for both locales). */
export type TurnCostKey =
  | 'cost.label'
  | 'cost.total'
  | 'cost.hit'
  | 'cost.miss'
  | 'cost.output'
  | 'cost.turn'
  | 'cost.toggleHint'
  | 'cost.expandAll'
  | 'cost.collapseAll'
  | 'cost.note'
  | 'cost.stats'
  | 'cost.statsClose'
  | 'cost.composition'
  | 'cost.trend'
  | 'cost.byRoute'
  | 'cost.bySchedule'
  | 'cost.cacheSaved'
  | 'cost.ifAllMiss'
  | 'cost.turnIndex'
  | 'cost.cumulativeLabel'
  | 'cost.trendHint'
  | 'cost.tokens'
  | 'cost.share'
  | 'cost.bucket.uncached'
  | 'cost.bucket.hit'
  | 'cost.bucket.write'
  | 'cost.bucket.output'
  | 'cost.schedule.flat'
  | 'cost.schedule.peak'
  | 'cost.schedule.offPeak'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Inline turn-tail cost readout copy. */
    'turnCost': TurnCostKey
  }
}

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh: Record<TurnCostKey, string> = {
  'cost.label': '费用',
  'cost.total': '累计费用 {cost}',
  'cost.hit': '命中 {cost}',
  'cost.miss': '未命中 {cost}',
  'cost.output': '输出 {cost}',
  'cost.turn': '本轮 {cost}',
  'cost.toggleHint': '点击显示/隐藏',
  'cost.expandAll': '展开所有轮次费用',
  'cost.collapseAll': '收起所有轮次费用',
  'cost.note': '费用为按 DeepSeek 价格表的估算值（2026-08-17 前平价、之后峰谷）',
  'cost.stats': '费用统计',
  'cost.statsClose': '关闭',
  'cost.composition': '构成',
  'cost.trend': '趋势',
  'cost.byRoute': '按模型',
  'cost.bySchedule': '按价区',
  'cost.cacheSaved': '缓存节省 {cost}',
  'cost.ifAllMiss': '若全部未命中 {cost}',
  'cost.turnIndex': '第 {turn} 轮',
  'cost.cumulativeLabel': '累计',
  'cost.trendHint': '悬停柱切换明细 · 柱按本轮最高归一 · 线为累计',
  'cost.tokens': '{tokens} tok',
  'cost.share': '{percent}%',
  'cost.bucket.uncached': '未命中',
  'cost.bucket.hit': '命中',
  'cost.bucket.write': '缓存写入',
  'cost.bucket.output': '输出',
  'cost.schedule.flat': '平价',
  'cost.schedule.peak': '峰时',
  'cost.schedule.offPeak': '谷时',
}

/** English dictionary. */
export const en: Record<TurnCostKey, string> = {
  'cost.label': 'Cost',
  'cost.total': 'Total cost {cost}',
  'cost.hit': 'Hit {cost}',
  'cost.miss': 'Miss {cost}',
  'cost.output': 'Output {cost}',
  'cost.turn': 'This turn {cost}',
  'cost.toggleHint': 'Click to show/hide',
  'cost.expandAll': 'Expand all turn costs',
  'cost.collapseAll': 'Collapse all turn costs',
  'cost.note': 'Estimated from the DeepSeek price table (flat before 2026-08-17, peak/off-peak after)',
  'cost.stats': 'Cost stats',
  'cost.statsClose': 'Close',
  'cost.composition': 'Breakdown',
  'cost.trend': 'Trend',
  'cost.byRoute': 'By model',
  'cost.bySchedule': 'By schedule',
  'cost.cacheSaved': 'Cache saved {cost}',
  'cost.ifAllMiss': 'If all miss {cost}',
  'cost.turnIndex': 'Turn {turn}',
  'cost.cumulativeLabel': 'Cumulative',
  'cost.trendHint': 'Hover a bar to switch detail · bars scaled to the peak turn · line is cumulative',
  'cost.tokens': '{tokens} tok',
  'cost.share': '{percent}%',
  'cost.bucket.uncached': 'Miss',
  'cost.bucket.hit': 'Hit',
  'cost.bucket.write': 'Cache write',
  'cost.bucket.output': 'Output',
  'cost.schedule.flat': 'Flat',
  'cost.schedule.peak': 'Peak',
  'cost.schedule.offPeak': 'Off-peak',
}
