import type { RenderElement } from 'claude-code'

import { cacheHitRate, totalCost } from '../core/cost.ts'
import type { ModelTotals, Totals } from '../core/cost.ts'
import { barWidths, formatCount, formatShare, formatUsd } from '../core/format.ts'
import type { Period } from '../core/summary.ts'

import type { Ready, Ui } from './ui.ts'

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

const MODELS_SHOWN = 8

function modelsView(ui: Ui, models: readonly ModelTotals[]) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">By model</Text>
      {models.slice(0, MODELS_SHOWN).map((one) => {
        const price = one.isPriced ? formatUsd(totalCost(one.cost)) : 'no published price'
        const details =
          `${formatCount(one.requests)} requests · ` +
          `cache hit rate ${formatShare(cacheHitRate(one.tokens))}`
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Text>{one.model}</Text>
              <Text color={one.isPriced ? 'success' : 'warning'}>{price}</Text>
            </Box>
            <Text dimColor>{details}</Text>
          </Box>
        )
      })}
      {models.length > MODELS_SHOWN ? (
        <Text dimColor>{`and ${String(models.length - MODELS_SHOWN)} more`}</Text>
      ) : null}
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
      {modelsView(ui, state.summary.byModel[period])}
    </Box>
  )
}
