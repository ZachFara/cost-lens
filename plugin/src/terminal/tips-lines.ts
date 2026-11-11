/** The terminal view's Tips tab, as the pane's (plugin/src/mod/tips-view.tsx) draws it. */
import { formatCount, formatShare, formatUsd } from '../core/format.ts'
import type { Summary, UseCost } from '../core/summary.ts'
import { LARGE_CONTEXT_TOKENS } from '../core/tips.ts'

import { span, spread, wrap } from './text.ts'
import type { Line } from './text.ts'
import { BLANK } from './views.ts'

/** MCP server names as a session lists them: `claude_ai_Linear` reads "claude.ai Linear". */
function serverName(name: string): string {
  return name.replace(/^claude_ai_/, 'claude.ai ').replaceAll('_', ' ')
}

function share(part: number, whole: number): string {
  return formatShare(whole === 0 ? 0 : part / whole)
}

function usesLines(title: string, uses: readonly UseCost[], total: number, width: number) {
  if (uses.length === 0) return []
  return [
    BLANK,
    spread(span(title, 'bold'), span('% of usage', 'dim'), width),
    ...uses.map((use) => spread(span(use.name), span(share(use.cost, total)), width)),
  ]
}

function tipLine(percent: string, text: string): Line {
  return [span(percent.padStart(4), 'warning'), span(` ${text}`)]
}

function tips(summary: Summary): Line[] {
  const day = summary.tips.last24h
  const mcpCost = day.mcpServers.reduce((sum, server) => sum + server.cost, 0)
  const lines: Line[] = []
  if (day.largeContextCost > 0) {
    const percent = share(day.largeContextCost, day.cost)
    lines.push(tipLine(percent, 'Start fresh when you switch tasks · run /clear'))
  }
  if (mcpCost > 0) {
    const percent = share(Math.min(mcpCost, day.cost), day.cost)
    lines.push(tipLine(percent, "Turn off MCP servers you don't use"))
  }
  return lines
}

function dayLines(summary: Summary, width: number): Line[] {
  const day = summary.tips.last24h
  if (day.cost === 0) return [[span('No Claude Code use in the last 24 hours.', 'dim')]]
  const servers = day.mcpServers.map((server) => ({ ...server, name: serverName(server.name) }))
  const advice = tips(summary)
  return [
    [span('What is contributing to your usage?', 'bold')],
    [span('Last 24 hours · approximate · this machine only · shares overlap', 'dim')],
    ...(advice.length > 0 ? [BLANK, ...advice] : []),
    ...usesLines('Skills', day.skills, day.cost, width),
    ...usesLines('MCP servers', servers, day.cost, width),
  ]
}

function monthLines(summary: Summary, width: number): Line[] {
  const month = summary.tips.last30
  if (month.cost === 0) return []
  const cold =
    `${formatCount(month.coldRebuilds)} times a message re-wrote an expired cache: about ` +
    `${formatUsd(month.coldWaste)} more than a warm cache (${share(month.coldWaste, month.cost)} of cost). ` +
    'Run /compact before a long break, or start a new session after one.'
  const large =
    `${share(month.largeContextCost, month.cost)} of cost was at over ${String(LARGE_CONTEXT_TOKENS / 1000)}k tokens of context. ` +
    'Use /compact mid-task and /clear when switching tasks.'
  return [
    BLANK,
    [span('Last 30 days', 'bold')],
    ...(month.coldRebuilds > 0 ? [BLANK, ...wrap(cold, width)] : []),
    ...(month.largeContextCost > 0 ? [BLANK, ...wrap(large, width)] : []),
  ]
}

/** Tips: what drives usage in the last 24 hours, and avoidable cost in the last 30 days. */
export function tipsLines(summary: Summary, width: number): Line[] {
  return [...dayLines(summary, width), ...monthLines(summary, width)]
}
