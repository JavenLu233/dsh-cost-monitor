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
}
