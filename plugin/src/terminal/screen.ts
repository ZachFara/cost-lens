/**
 * The terminal view's whole screen: the tab row, the selected tab's lines (scrolled),
 * and a status line; and what each key does. Pure: the program in cli.ts does the I/O.
 */
import { formatClock } from '../core/format.ts'
import type { Period, Summary } from '../core/summary.ts'

import { nowLines } from './now-lines.ts'
import { cells, span, spread, wrap } from './text.ts'
import type { Line, Span } from './text.ts'
import { tipsLines } from './tips-lines.ts'
import { BLANK, branchesLines, periodLines, projectsLines, prsLines } from './views.ts'
import type { PullRequests } from './views.ts'

export type Tab = 'now' | 'today' | 'last30' | 'all' | 'projects' | 'branches' | 'prs' | 'tips'

/**
 * The pane's tabs, but Model, which needs a Claude Code session; Now shows the sessions
 * in the logs instead of the running one.
 */
export const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'now', label: 'Now' },
  { id: 'today', label: 'Today' },
  { id: 'last30', label: '30 days' },
  { id: 'all', label: 'All time' },
  { id: 'projects', label: 'Projects' },
  { id: 'branches', label: 'Branches' },
  { id: 'prs', label: 'PRs' },
  { id: 'tips', label: 'Tips' },
]

const PERIOD_OF: Partial<Record<Tab, Period>> = { today: 'today', last30: 'last30', all: 'allTime' }

/** Where reading the logs stands; a refresh keeps the last summary on screen. */
export type History =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; summary: Summary; isRefreshing: boolean; refreshError: string | null }

export interface View {
  tab: Tab
  /** The first line of the tab shown. */
  scroll: number
  history: History
  prs: PullRequests
  /** The time the screen is drawn at, in milliseconds: the Now tab counts down from it. */
  now: number
}

/** The selected tab's lines, before scrolling. */
export function tabLines(view: View, width: number): Line[] {
  const { history } = view
  if (history.status === 'loading') return [[span('Reading your Claude Code logs…', 'dim')]]
  if (history.status === 'error') {
    return wrap(`Could not read the logs: ${history.message}`, width, 'error')
  }
  const { summary } = history
  const period = PERIOD_OF[view.tab]
  if (view.tab === 'now') return nowLines(summary, view.now, width)
  if (period !== undefined) return periodLines(summary, period, width)
  if (view.tab === 'projects') return projectsLines(summary, width)
  if (view.tab === 'branches') return branchesLines(summary, width)
  if (view.tab === 'prs') return prsLines(summary, view.prs, width)
  return tipsLines(summary, width)
}

/** The title and a button per tab, in as many rows as the width needs. */
function tabRows(selected: Tab, width: number): Line[] {
  const buttons = TABS.map((one, index) =>
    span(` ${String(index + 1)} ${one.label} `, one.id === selected ? 'selected' : 'dim'),
  )
  const rows: Span[][] = [[span('cost-lens', 'bold')]]
  let used = cells('cost-lens')
  for (const button of buttons) {
    const row = rows[rows.length - 1] ?? []
    if (used + 1 + cells(button.text) > width) {
      rows.push([button])
      used = cells(button.text)
      continue
    }
    row.push(span(' '), button)
    used += 1 + cells(button.text)
  }
  return rows
}

function status(history: History): Span {
  if (history.status !== 'ready') return span('')
  if (history.isRefreshing) return span('Refreshing…', 'dim')
  if (history.refreshError !== null) {
    return span(`Last refresh failed: ${history.refreshError}`, 'warning')
  }
  const { generatedAt, pricesFetched } = history.summary
  return span(`Read at ${formatClock(generatedAt)} · prices of ${pricesFetched}`, 'dim')
}

/** The key hints, longest first: a narrow screen shows the longest that fits. */
const HINTS = [
  `1-${String(TABS.length)} tabs · ↑↓ scroll · r refresh · q quit`,
  'r refresh · q quit',
  'q quit',
]

function footer(history: History, more: string, width: number): Line {
  const left = status(history)
  const fits = (hint: string) => cells(left.text) + 1 + cells(more + hint) <= width
  const hint = HINTS.find(fits) ?? 'q quit'
  return spread(left, span(more + hint, 'dim'), width)
}

/** The terminal's size in cells. */
export interface Size {
  columns: number
  rows: number
}

/** The rows the tab's lines get: all but the tab rows, the footer and a blank row each. */
function bodyRows({ columns, rows }: Size): number {
  return Math.max(1, rows - tabRows('today', columns).length - 3)
}

/** The furthest a tab of `length` lines scrolls on a screen this size. */
function maxScroll(length: number, size: Size): number {
  return Math.max(0, length - bodyRows(size))
}

/** The whole screen: `rows` lines of at most `columns` cells. */
export function frame(view: View, size: Size): Line[] {
  const lines = tabLines(view, size.columns)
  const height = bodyRows(size)
  const top = Math.min(view.scroll, maxScroll(lines.length, size))
  const body = lines.slice(top, top + height)
  const filler = Array.from({ length: height - body.length }, () => BLANK)
  const more = top + height < lines.length ? '↓ more · ' : ''
  return [
    ...tabRows(view.tab, size.columns),
    BLANK,
    ...body,
    ...filler,
    BLANK,
    footer(view.history, more, size.columns),
  ]
}

export type Command = 'quit' | 'refresh'

const MOVES: Partial<Record<string, (scroll: number, page: number) => number>> = {
  '\x1b[A': (scroll) => scroll - 1,
  k: (scroll) => scroll - 1,
  '\x1b[B': (scroll) => scroll + 1,
  j: (scroll) => scroll + 1,
  '\x1b[5~': (scroll, page) => scroll - page,
  b: (scroll, page) => scroll - page,
  '\x1b[6~': (scroll, page) => scroll + page,
  ' ': (scroll, page) => scroll + page,
  g: () => 0,
  G: () => Number.MAX_SAFE_INTEGER,
}

const STEPS: Partial<Record<string, number>> = {
  '\x1b[C': 1,
  l: 1,
  '\t': 1,
  '\x1b[D': -1,
  h: -1,
  '\x1b[Z': -1,
}

const COMMANDS: Partial<Record<string, Command>> = { q: 'quit', '\x03': 'quit', r: 'refresh' }

function withTab(view: View, index: number): View {
  const tab = TABS[(index + TABS.length) % TABS.length]?.id ?? view.tab
  return tab === view.tab ? view : { ...view, tab, scroll: 0 }
}

/**
 * What a key does on a screen this size: switch tabs (1 to 8, ←/→, tab), scroll (↑/↓,
 * page up/down, space, g/G), refresh (r) or quit (q, ctrl+c). Other keys do nothing.
 */
export function pressKey(view: View, key: string, size: Size): { view: View; command?: Command } {
  const command = COMMANDS[key]
  if (command !== undefined) return { view, command }
  const number = /^[1-9]$/.test(key) ? Number(key) : 0
  if (number >= 1 && number <= TABS.length) return { view: withTab(view, number - 1) }
  const step = STEPS[key]
  const current = TABS.findIndex((one) => one.id === view.tab)
  if (step !== undefined) return { view: withTab(view, current + step) }
  const move = MOVES[key]
  if (move === undefined) return { view }
  const length = tabLines(view, size.columns).length
  const scroll = Math.min(Math.max(0, move(view.scroll, bodyRows(size))), maxScroll(length, size))
  return { view: { ...view, scroll } }
}

/** A log read's outcome: new numbers, or, after a failed refresh, the last ones and why. */
export function afterRead(
  current: History,
  result: { summary: Summary } | { error: string },
): History {
  if ('summary' in result) {
    return { status: 'ready', summary: result.summary, isRefreshing: false, refreshError: null }
  }
  return current.status === 'ready'
    ? { ...current, isRefreshing: false, refreshError: result.error }
    : { status: 'error', message: result.error }
}

const ESCAPE = '\u001b'

/**
 * The keys in what the terminal sent: an escape sequence (an arrow, page up or down) is
 * one key, any other character is one; a paste holds several.
 */
export function keysIn(data: string): string[] {
  const keys: string[] = []
  let at = 0
  while (at < data.length) {
    let end = at + 1
    if (data[at] === ESCAPE && data[at + 1] === '[') {
      end = at + 2
      while (end < data.length && /[\d;]/.test(data[end] ?? '')) end += 1
      end += 1
    }
    keys.push(data.slice(at, end))
    at = end
  }
  return keys
}
