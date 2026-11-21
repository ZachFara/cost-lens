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
import { BLANK, BLOCK, SHADE } from './views.ts'

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
  // No-break spaces: a line never ends on "≈" or splits "(warm: $0.09)".
  const price =
    next === null ? '' : ` ≈\u00a0${formatUsd(next.cold)} (warm:\u00a0${formatUsd(next.warm)})`
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

/** A path too long for the line keeps its end, which names the folder. */
function pathEnd(path: string, width: number): string {
  const chars = Array.from(path)
  return chars.length <= width ? path : `…${chars.slice(chars.length - width + 1).join('')}`
}

/** Where and how the session ran: on one line when it fits, else the folder on its own. */
function detailLines(session: RecentSession, now: number, width: number): Line[] {
  const rest = [
    session.model,
    formatWhen(session.lastAt, new Date(now)),
    formatRequests(session.requests),
  ]
    .filter((part) => part !== '')
    .join(' · ')
  const lines =
    session.path === ''
      ? [rest]
      : cells(session.path) + 3 + cells(rest) <= width
        ? [`${session.path} · ${rest}`]
        : [pathEnd(session.path, width), rest]
  return lines.map((line) => [span(line, 'dim')])
}

function sessionLines(session: RecentSession, now: number, width: number): Line[] {
  return [
    BLANK,
    spread(span(nameOf(session)), span(formatUsd(session.cost), 'success'), width),
    ...detailLines(session, now, width),
    ...cacheLines(session, now, width),
  ]
}

/** The pane's plan usage: each window's label, percent used and reset time, then its bar. */
function planLines(plan: PlanReading, now: number, width: number): Line[] {
  const at = new Date(now)
  const windows = planWindows(plan.windows, [], now).flatMap((limit): Line[] => {
    const used = Math.min(100, Math.max(0, limit.percentUsed))
    const [filled = 0, rest = 0] = barWidths([used, 100 - used], width)
    const resets = limit.resetsAt === undefined ? '' : formatResets(limit.resetsAt, at)
    return [
      BLANK,
      spread(span(limitLabel(limit.kind)), span(`${String(limit.percentUsed)}% used`), width),
      ...(resets === '' ? [] : [[span(resets, 'dim')]]),
      BLANK,
      [span(BLOCK.repeat(filled), limitTone(limit.percentUsed)), span(SHADE.repeat(rest), 'dim')],
    ]
  })
  // When Claude Code last reported the windows: the terminal view cannot ask for them.
  const read = span(`as of ${formatWhen(new Date(plan.at).toISOString(), at)}`, 'dim')
  return [spread(span('Plan usage', 'bold'), read, width), ...windows, BLANK]
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
