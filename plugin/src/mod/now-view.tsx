import type { SessionRateLimit, SessionUsage } from 'claude-code'

import {
  formatRequests,
  formatResets,
  formatShare,
  formatTokens,
  formatUsd,
} from '../core/format.ts'
import { barWidths } from '../core/format.ts'

import { contextGrid } from './context-grid.tsx'
import { splitView } from './period-view.tsx'
import { planWindows } from './plan-windows.ts'
import type { PlanWindow, SummaryTotals } from '../../types'

import type { Ui } from './ui.ts'

/** What the Now tab draws: read from the engine by the hooks module. */
export interface NowFacts {
  usage: SessionUsage
  model: string
  live: SummaryTotals
  /** The time now, in milliseconds. */
  now: number
  /** The plan windows last read, kept for when the engine stops reporting one. */
  remembered: readonly PlanWindow[]
}

/** The windows `/usage` shows, by the names the API reports them under. */
function limitLabel(kind: string): string {
  if (kind === 'five_hour') return 'Current session'
  if (kind === 'seven_day') return 'Current week (all models)'
  if (kind === 'spend_limit') return 'Spend limit'
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  if (model !== undefined) return `Current week (${model[0]?.toUpperCase() ?? ''}${model.slice(1)})`
  return kind
}

function limitColor(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 80) return 'error'
  return percent >= 50 ? 'warning' : 'success'
}

function limitsView(ui: Ui, limits: readonly SessionRateLimit[], at: number, columns: number) {
  const { Box, Text } = ui
  if (limits.length === 0) {
    return <Text dimColor>Plan usage appears after this session's first reply.</Text>
  }
  const now = new Date(at)
  const width = Math.max(10, columns - 2)
  return (
    <Box flexDirection="column" gap={1}>
      {limits.map((limit) => {
        const used = Math.min(100, Math.max(0, limit.percentUsed))
        const [filled = 0, rest = 0] = barWidths([used, 100 - used], width)
        const resets = limit.resetsAt === undefined ? '' : formatResets(limit.resetsAt, now)
        return (
          <Box flexDirection="column">
            <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
              <Text weight="semibold">{limitLabel(limit.kind)}</Text>
              <Text>{`${String(limit.percentUsed)}% used`}</Text>
            </Box>
            <Box flexDirection="row">
              <Text color={limitColor(limit.percentUsed)}>{'█'.repeat(filled)}</Text>
              <Text dimColor>{'░'.repeat(rest)}</Text>
            </Box>
            {resets === '' ? null : <Text dimColor>{resets}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}

/**
 * The width to ask the context grid for. Under 80 columns the engine draws a 5-wide grid;
 * at 80 or more, 20 squares wide. A square takes two cells here, so the full-size grid
 * fits any pane of 40 columns or more.
 */
export function gridColumns(columns: number): number {
  return columns >= FULL_GRID_CELLS ? Math.max(columns, FULL_GRID_ASK) : columns
}

const FULL_GRID_CELLS = 40
const FULL_GRID_ASK = 80

/** Now: the plan's usage limits, then this session's model, cost, split and context. */
export function nowView(ui: Ui, facts: NowFacts | undefined, columns: number) {
  const { Box, Text } = ui
  if (facts === undefined) return <Text dimColor>Session details are not available here.</Text>
  const { usage, model, live, now, remembered } = facts
  const { context } = usage
  const contextLine =
    context.tokens === undefined
      ? `Context window ${formatTokens(context.window)}`
      : `Context ${formatTokens(context.tokens)} of ${formatTokens(context.window)} (${formatShare(context.tokens / context.window)})`
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">Plan usage</Text>
      {limitsView(ui, planWindows(usage.rateLimits, remembered, now), now, columns)}
      <Box flexDirection="column">
        <Text weight="semibold">This session</Text>
        <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Text>{model}</Text>
          <Text color="success">{usage.cost ? formatUsd(usage.cost.usd) : ''}</Text>
        </Box>
        <Text dimColor>{`${contextLine} · ${formatRequests(live.requests)}`}</Text>
      </Box>
      {live.requests > 0 ? splitView(ui, live, columns) : null}
      {context.breakdown === undefined ? null : contextGrid(ui, context.breakdown)}
    </Box>
  )
}
