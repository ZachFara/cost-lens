import { formatCount, formatShare, formatTokens, formatUsd } from '../core/format.ts'
import type { UseCost } from '../core/summary.ts'
import { LARGE_CONTEXT_TOKENS } from '../core/tips.ts'

import type { Ready, Ui } from './ui.ts'

/** MCP server names as the session lists them: `claude_ai_Linear` reads "claude.ai Linear". */
function serverName(name: string): string {
  return name.replace(/^claude_ai_/, 'claude.ai ').replaceAll('_', ' ')
}

function share(part: number, whole: number): string {
  return formatShare(whole === 0 ? 0 : part / whole)
}

function usesView(ui: Ui, title: string, uses: readonly UseCost[], total: number) {
  const { Box, Text } = ui
  if (uses.length === 0) return null
  return (
    <Box flexDirection="column">
      <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
        <Text weight="semibold">{title}</Text>
        <Text dimColor>% of usage</Text>
      </Box>
      {uses.map((use) => (
        <Box flexDirection="row" justifyContent="space-between" columnGap={1}>
          <Text>{use.name}</Text>
          <Text>{share(use.cost, total)}</Text>
        </Box>
      ))}
    </Box>
  )
}

function tipLine(ui: Ui, percent: string, text: string) {
  const { Box, Text } = ui
  return (
    <Box flexDirection="row" columnGap={1}>
      <Text color="warning">{percent.padStart(4)}</Text>
      <Text>{text}</Text>
    </Box>
  )
}

function dayView(ui: Ui, state: Ready, mcpTokens: number | undefined) {
  const { Box, Text } = ui
  const day = state.summary.tips.last24h
  if (day.cost === 0) return <Text dimColor>No Claude Code use in the last 24 hours.</Text>
  const mcpCost = day.mcpServers.reduce((sum, server) => sum + server.cost, 0)
  const servers = day.mcpServers.map((server) => ({ ...server, name: serverName(server.name) }))
  const perRequest =
    mcpTokens === undefined ? '' : ` · ${formatTokens(mcpTokens)} tokens per request`
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text weight="semibold">What is contributing to your usage?</Text>
        <Text dimColor>Last 24 hours · approximate · this machine only · shares overlap</Text>
      </Box>
      <Box flexDirection="column">
        {day.largeContextCost > 0
          ? tipLine(
              ui,
              share(day.largeContextCost, day.cost),
              'Start fresh when you switch tasks · run /clear',
            )
          : null}
        {mcpCost > 0
          ? tipLine(
              ui,
              share(Math.min(mcpCost, day.cost), day.cost),
              `Turn off MCP servers you don't use${perRequest}`,
            )
          : null}
      </Box>
      {usesView(ui, 'Skills', day.skills, day.cost)}
      {usesView(ui, 'MCP servers', servers, day.cost)}
    </Box>
  )
}

function monthView(ui: Ui, state: Ready) {
  const { Box, Text } = ui
  const month = state.summary.tips.last30
  if (month.cost === 0) return null
  const cold =
    `${formatCount(month.coldRebuilds)} times a message re-wrote an expired cache: about ` +
    `${formatUsd(month.coldWaste)} more than a warm cache (${share(month.coldWaste, month.cost)} of cost). ` +
    'Run /compact before a long break, or start a new session after one.'
  const large =
    `${share(month.largeContextCost, month.cost)} of cost was at over ${String(LARGE_CONTEXT_TOKENS / 1000)}k tokens of context. ` +
    'Use /compact mid-task and /clear when switching tasks.'
  return (
    <Box flexDirection="column" gap={1}>
      <Text weight="semibold">Last 30 days</Text>
      {month.coldRebuilds > 0 ? <Text>{cold}</Text> : null}
      {month.largeContextCost > 0 ? <Text>{large}</Text> : null}
    </Box>
  )
}

/** Tips: what drives usage in the last 24 hours, and avoidable cost in the last 30 days. */
export function tipsView(ui: Ui, state: Ready, mcpTokens: number | undefined) {
  return (
    <ui.Box flexDirection="column" gap={1}>
      {dayView(ui, state, mcpTokens)}
      {monthView(ui, state)}
    </ui.Box>
  )
}
