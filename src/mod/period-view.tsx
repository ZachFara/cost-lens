import type { RenderElement } from 'claude-code'

import { cacheHitRate, totalCost } from '../core/cost.ts'
import type { Totals } from '../core/cost.ts'
import { barWidths, formatCount, formatShare, formatUsd } from '../core/format.ts'

import type { Ready, Ui } from './ui.ts'

export type Period = 'today' | 'last30' | 'allTime'

const EMPTY: Record<Period, string> = {
  today: 'No Claude Code use today yet.',
  last30: 'No Claude Code use in the last 30 days.',
  allTime: 'No Claude Code use found in the logs.',
}

const CATEGORIES = [
  // Theme colors, so they follow the person's theme; four different hues
  // (blue, yellow, red, green) so no two categories look alike.
  { key: 'input', label: 'Input', color: 'suggestion' },
  { key: 'output', label: 'Output', color: 'warning' },
  { key: 'cacheWrite', label: 'Cache writes', color: 'error' },
  { key: 'cacheRead', label: 'Cache reads', color: 'success' },
] as const

function splitView(ui: Ui, totals: Totals, columns: number): RenderElement {
  const { Box, Text } = ui
  const total = totalCost(totals.cost)
  const values = CATEGORIES.map((category) => totals.cost[category.key])
  const widths = barWidths(values, Math.max(10, columns - 2))
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="row">
        {CATEGORIES.map((category, index) => (
          <Text color={category.color}>{'█'.repeat(widths[index] ?? 0)}</Text>
        ))}
      </Box>
      <Box flexDirection="column">
        {CATEGORIES.map((category, index) => {
          const value = values[index] ?? 0
          const share = formatShare(total === 0 ? 0 : value / total)
          return (
            <Box flexDirection="row" columnGap={1}>
              <Text color={category.color}>■</Text>
              <Text>{`${category.label}: ${formatUsd(value)} (${share})`}</Text>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

/** Today, 30 days or All time: the total, request count, hit rate and cost split. */
export function periodView(ui: Ui, state: Ready, period: Period, columns: number) {
  const { Box, Text } = ui
  const totals = state.summary[period]
  if (totals.requests === 0) return <Text dimColor>{EMPTY[period]}</Text>
  const requests = `${formatCount(totals.requests)} requests`
  const hitRate = `cache hit rate ${formatShare(cacheHitRate(totals.tokens))}`
  const unpriced =
    `${formatCount(totals.unpricedRequests)} requests from models without a published ` +
    `price are not in the total: ${totals.unpricedModels.join(', ')}`
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text weight="semibold" color="success">
          {formatUsd(totalCost(totals.cost))}
        </Text>
        <Text dimColor>{`${requests} · ${hitRate}`}</Text>
      </Box>
      {splitView(ui, totals, columns)}
      {totals.unpricedRequests > 0 ? <Text color="warning">{unpriced}</Text> : null}
    </Box>
  )
}
