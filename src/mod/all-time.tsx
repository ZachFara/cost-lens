import type {
  BoxProps,
  ButtonProps,
  ElementConstructor,
  RenderElement,
  TextProps,
} from 'claude-code'

import { cacheHitRate, totalCost } from '../core/cost.ts'
import type { Totals } from '../core/cost.ts'
import { barWidths, formatClock, formatCount, formatShare, formatUsd } from '../core/format.ts'
import type { History } from '../../types'

/** What the tab's buttons do. */
export interface Actions {
  load: () => void
  refresh: () => void
}

type Ready = Extract<History, { status: 'ready' }>

/** The elements every surface draws, as `$.ui.resolve(e)` hands them out. */
export interface Ui {
  Box: ElementConstructor<BoxProps>
  Text: ElementConstructor<TextProps>
  Button: ElementConstructor<ButtonProps>
}

const CATEGORIES = [
  { key: 'input', label: 'Input', color: 'suggestion' },
  { key: 'output', label: 'Output', color: 'claude' },
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

function freshnessView(ui: Ui, state: Ready, refresh: () => void) {
  const { Box, Button, Text } = ui
  const when = state.isRefreshing
    ? 'Refreshing…'
    : `Read at ${formatClock(state.summary.generatedAt)}`
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" columnGap={1}>
        <Text dimColor>{when}</Text>
        <Button key="refresh" label="Refresh" onPress={refresh} />
      </Box>
      {state.refreshError === null ? null : (
        <Text color="warning">{`Last refresh failed: ${state.refreshError}`}</Text>
      )}
    </Box>
  )
}

function summaryView(ui: Ui, state: Ready, columns: number, refresh: () => void) {
  const { Box, Text } = ui
  const totals = state.summary.allTime
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
      <Text dimColor>
        {`Estimated from this machine's logs at Anthropic's published prices (${state.summary.pricesFetched}).`}
      </Text>
      {freshnessView(ui, state, refresh)}
    </Box>
  )
}

/** The All time tab: what the analyzer found, or where reading the logs stands. */
export function allTimeView(ui: Ui, state: History, columns: number, actions: Actions) {
  const { Box, Button, Text } = ui
  switch (state.status) {
    case 'idle':
      return <Button key="load" label="Read my logs" onPress={actions.load} />
    case 'loading':
      return <Text dimColor>Reading your Claude Code logs…</Text>
    case 'error':
      return (
        <Box flexDirection="column" gap={1}>
          <Text color="error">{`Could not read the logs: ${state.message}`}</Text>
          <Button key="load" label="Try again" onPress={actions.load} />
        </Box>
      )
    case 'ready':
      return summaryView(ui, state, columns, actions.refresh)
  }
}
