/**
 * The terminal view's Now tab: plan usage as the mod last saved it from a Claude Code
 * session, then the last day's sessions from the logs, each with its cost so far and
 * whether its prompt cache is still warm. The context grid needs a running session, so
 * only the pane's Now tab has it.
 */
import { cacheMsLeft } from '../core/cache.ts'
import {
  barWidths,
  formatDuration,
  formatRequests,
  formatResets,
  formatTokens,
  formatUsd,
  formatWhen,
} from '../core/format.ts'
import { limitLabel, limitTone, planWindows } from '../core/plan.ts'
import type { PlanReading } from '../core/plan.ts'
import type { RecentSession, Summary } from '../core/summary.ts'

import { cells, span, spread, wrap } from './text.ts'
import type { Line } from './text.ts'
import { BLANK } from './views.ts'

function nameOf(session: RecentSession): string {
  if (session.title !== '') return session.title
  const name = session.path.slice(session.path.lastIndexOf('/') + 1)
  return name === '' ? '(untitled session)' : name
}

/** The band's line, per session: a warm countdown, or what a cold cache costs to re-write. */
function cacheLines(session: RecentSession, now: number, width: number): Line[] {
  const at = Date.parse(session.lastAt)
  const left = cacheMsLeft(now, at, session.cacheLifetimeMs)
  const context = formatTokens(session.contextTokens)
  const { next } = session
  const price = next === null ? '' : ` ≈ ${formatUsd(next.cold)} (warm: ${formatUsd(next.warm)})`
  const isWarm = left > 0
  const text = isWarm
    ? `cache warm · ${formatDuration(left)} left · ${context} context`
    : `cache cold · next message re-writes ${context} tokens${price}`
  const tone = isWarm ? 'success' : 'warning'
  return wrap(text, Math.max(1, width - 2), isWarm ? undefined : 'dim').map((line, index) => [
    span(index === 0 ? '● ' : '  ', tone),
    ...line,
  ])
}

/** Parts joined with " · ", a line broken only between parts (a part too long is cut). */
function joinParts(parts: readonly string[], width: number): Line[] {
  const lines: string[] = []
  for (const part of parts) {
    const last = lines.at(-1)
    if (last !== undefined && cells(last) + 3 + cells(part) <= width) {
      lines[lines.length - 1] = `${last} · ${part}`
    } else {
      lines.push(part)
    }
  }
  return lines.map((line) => [span(line, 'dim')])
}

function sessionLines(session: RecentSession, now: number, width: number): Line[] {
  const details = [
    session.path,
    session.model,
    formatWhen(session.lastAt, new Date(now)),
    formatRequests(session.requests),
  ].filter((part) => part !== '')
  return [
    BLANK,
    spread(span(nameOf(session)), span(formatUsd(session.cost), 'success'), width),
    ...joinParts(details, width),
    ...cacheLines(session, now, width),
  ]
}

/** The pane's plan usage: each window's label, percent used, bar and reset time. */
function planLines(plan: PlanReading, now: number, width: number): Line[] {
  const at = new Date(now)
  const windows = planWindows(plan.windows, [], now).flatMap((limit): Line[] => {
    const used = Math.min(100, Math.max(0, limit.percentUsed))
    const [filled = 0, rest = 0] = barWidths([used, 100 - used], width)
    const resets = limit.resetsAt === undefined ? '' : formatResets(limit.resetsAt, at)
    return [
      BLANK,
      spread(
        span(limitLabel(limit.kind), 'bold'),
        span(`${String(limit.percentUsed)}% used`),
        width,
      ),
      [span('█'.repeat(filled), limitTone(limit.percentUsed)), span('░'.repeat(rest), 'dim')],
      ...(resets === '' ? [] : [[span(resets, 'dim')]]),
    ]
  })
  const when = formatWhen(new Date(plan.at).toISOString(), at)
  return [
    [span('Plan usage', 'bold')],
    ...windows,
    BLANK,
    ...wrap(`As Claude Code last reported it, ${when}.`, width, 'dim'),
    BLANK,
  ]
}

const CONTEXT_NOTE = 'What fills the context shows in the Claude Code pane (/cost-lens).'
const NO_PLAN_NOTE =
  'Plan usage shows here once a Claude Code session with the cost-lens plugin has replied.'

/** Now: the plan usage last saved, then the sessions of the last 24 hours, as of `now`. */
export function nowLines(
  summary: Summary,
  plan: PlanReading | undefined,
  now: number,
  width: number,
): Line[] {
  const hasPlan = plan !== undefined && plan.windows.length > 0
  const usage = hasPlan ? planLines(plan, now, width) : []
  const note = wrap(hasPlan ? CONTEXT_NOTE : `${NO_PLAN_NOTE} ${CONTEXT_NOTE}`, width, 'dim')
  if (summary.sessions.length === 0) {
    return [
      ...usage,
      [span('No Claude Code sessions in the last 24 hours.', 'dim')],
      BLANK,
      ...note,
    ]
  }
  return [
    ...usage,
    [span('Sessions in the last 24 hours', 'bold')],
    ...summary.sessions.flatMap((session) => sessionLines(session, now, width)),
    BLANK,
    ...note,
  ]
}
