/**
 * The terminal view's Now tab: the last day's sessions from the logs, each with its cost
 * so far and whether its prompt cache is still warm. Plan usage and the context grid come
 * from a running Claude Code session, so only the pane's Now tab has them.
 */
import { cacheMsLeft } from '../core/cache.ts'
import { formatCount, formatDuration, formatTokens, formatUsd, formatWhen } from '../core/format.ts'
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
    `${formatCount(session.requests)} requests`,
  ].filter((part) => part !== '')
  return [
    BLANK,
    spread(span(nameOf(session)), span(formatUsd(session.cost), 'success'), width),
    ...joinParts(details, width),
    ...cacheLines(session, now, width),
  ]
}

/** Now: the sessions of the last 24 hours, most recent first, as of `now`. */
export function nowLines(summary: Summary, now: number, width: number): Line[] {
  const note = wrap(
    'Plan usage and what fills the context show in the Claude Code pane (/cost-lens).',
    width,
    'dim',
  )
  if (summary.sessions.length === 0) {
    return [[span('No Claude Code sessions in the last 24 hours.', 'dim')], BLANK, ...note]
  }
  return [
    [span('Sessions in the last 24 hours', 'bold')],
    ...summary.sessions.flatMap((session) => sessionLines(session, now, width)),
    BLANK,
    ...note,
  ]
}
