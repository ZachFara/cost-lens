/**
 * The terminal view's data tabs, drawn from the analyzer's summary as the pane draws them
 * (plugin/src/mod/*-view.tsx), as lines of styled text.
 */
import { cacheHitRate, totalCost } from '../core/cost.ts'
import type { ModelTotals, Totals } from '../core/cost.ts'
import { barWidths, formatCount, formatShare, formatUsd, formatWhen } from '../core/format.ts'
import { costPullRequests } from '../core/pull-requests.ts'
import type { PullRequest } from '../core/pull-requests.ts'
import type { Spend } from '../core/spend.ts'
import type { Period, Summary } from '../core/summary.ts'

import { span, spread, wrap } from './text.ts'
import type { Line, Span, Tone } from './text.ts'

/** The PRs tab's state: listing, listed, or why there is no list. */
export type PullRequests =
  | { status: 'loading' }
  | { status: 'ready'; prs: PullRequest[] }
  | { status: 'error'; message: string }

export const BLANK: Line = []

const EMPTY: Record<Period, string> = {
  today: 'No Claude Code use today yet.',
  last30: 'No Claude Code use in the last 30 days.',
  allTime: 'No Claude Code use found in the logs.',
}

const CATEGORIES = [
  { key: 'input', label: 'Input', tone: 'suggestion' },
  { key: 'output', label: 'Output', tone: 'warning' },
  { key: 'cacheWrite', label: 'Cache writes', tone: 'error' },
  { key: 'cacheRead', label: 'Cache reads', tone: 'success' },
] as const

function splitLines(totals: Totals, width: number): Line[] {
  const total = totalCost(totals.cost)
  const values = CATEGORIES.map((category) => totals.cost[category.key])
  const widths = barWidths(values, Math.max(10, width))
  const bar = CATEGORIES.map((category, index) =>
    span('█'.repeat(widths[index] ?? 0), category.tone),
  )
  const legend = CATEGORIES.map((category, index) => {
    const value = values[index] ?? 0
    const share = formatShare(total === 0 ? 0 : value / total)
    return [span('■ ', category.tone), span(`${category.label}: ${formatUsd(value)} (${share})`)]
  })
  return [bar, BLANK, ...legend]
}

const MODELS_SHOWN = 8

/** A name, its cost on the right, and a dim line of details under it. */
function costRow(name: string, cost: Span, details: string, width: number): Line[] {
  return [BLANK, spread(span(name), cost, width), [span(details, 'dim')]]
}

function modelLines(models: readonly ModelTotals[], width: number): Line[] {
  const rows = models.slice(0, MODELS_SHOWN).flatMap((one) => {
    const price = one.isPriced
      ? span(formatUsd(totalCost(one.cost)), 'success')
      : span('no published price', 'warning')
    const details =
      `${formatCount(one.requests)} requests · ` +
      `cache hit rate ${formatShare(cacheHitRate(one.tokens))}`
    return costRow(one.model, price, details, width)
  })
  const more =
    models.length > MODELS_SHOWN
      ? [BLANK, [span(`and ${String(models.length - MODELS_SHOWN)} more`, 'dim')]]
      : []
  return [[span('By model', 'bold')], ...rows, ...more]
}

/** Today, 30 days or All time: the total, request count, hit rate, cost split and models. */
export function periodLines(summary: Summary, period: Period, width: number): Line[] {
  const totals = summary[period]
  if (totals.requests === 0) return [[span(EMPTY[period], 'dim')]]
  const requests = `${formatCount(totals.requests)} requests`
  const hitRate = `cache hit rate ${formatShare(cacheHitRate(totals.tokens))}`
  const unpriced =
    `${formatCount(totals.unpricedRequests)} requests from models without a published ` +
    `price are not in the total: ${totals.unpricedModels.join(', ')}`
  return [
    [span(formatUsd(totalCost(totals.cost)), 'success')],
    [span(`${requests} · ${hitRate}`, 'dim')],
    BLANK,
    ...splitLines(totals, width),
    ...(totals.unpricedRequests > 0 ? [BLANK, ...wrap(unpriced, width, 'warning')] : []),
    BLANK,
    ...modelLines(summary.byModel[period], width),
  ]
}

function activity(spend: Spend, now: Date): string {
  const when = formatWhen(spend.lastActive, now)
  return `${formatCount(spend.requests)} requests${when === '' ? '' : ` · last active ${when}`}`
}

function splitPath(path: string): { name: string; folder: string } {
  const at = path.lastIndexOf('/')
  return at < 0
    ? { name: path, folder: '' }
    : { name: path.slice(at + 1), folder: path.slice(0, at) }
}

/** Projects: the last 30 days' most expensive working folders. */
export function projectsLines(summary: Summary, width: number): Line[] {
  const { projects } = summary
  if (projects.length === 0) return [[span('No Claude Code use in the last 30 days.', 'dim')]]
  const now = new Date(summary.generatedAt)
  return [
    [span('Last 30 days, by project', 'bold')],
    ...projects.flatMap((project) => {
      const { name, folder } = splitPath(project.path)
      const details = [folder, activity(project.last30, now)].filter((part) => part !== '')
      const cost = span(formatUsd(totalCost(project.last30.cost)), 'success')
      return costRow(name === '' ? project.path : name, cost, details.join(' · '), width)
    }),
  ]
}

/** Branches: the repository's branches, all time, most expensive first. */
export function branchesLines(summary: Summary, width: number): Line[] {
  const project = summary.currentProject
  if (project === null) {
    return [[span('Start cost-lens in a project folder to see its branches.', 'dim')]]
  }
  if (project.branches.length === 0) {
    return [[span(`No Claude Code use recorded in ${project.path} yet.`, 'dim')]]
  }
  const now = new Date(summary.generatedAt)
  return [
    [span(`Branches in ${project.path}`, 'bold')],
    ...project.branches.flatMap(({ branch, spend }) => {
      const cost = span(formatUsd(totalCost(spend.cost)), 'success')
      return costRow(branch === '' ? '(no branch)' : branch, cost, activity(spend, now), width)
    }),
  ]
}

const STATE_TONE: Partial<Record<string, Tone>> = { OPEN: 'success', MERGED: 'permission' }

/** PRs: the repository's pull requests, each with what its head branch cost. */
export function prsLines(summary: Summary, prs: PullRequests, width: number): Line[] {
  if (prs.status === 'loading') return [[span('Listing pull requests with gh…', 'dim')]]
  if (prs.status === 'error') return wrap(`No pull requests: ${prs.message}`, width, 'warning')
  const rows = costPullRequests(prs.prs, summary.currentProject?.branches ?? [])
  if (rows.length === 0) return [[span('This repository has no pull requests.', 'dim')]]
  return [
    [span('Pull requests, by what their branch cost', 'bold')],
    ...rows.flatMap((one) => {
      const cost = one.spend
        ? span(formatUsd(totalCost(one.spend.cost)), 'success')
        : span('no Claude Code use', 'dim')
      const requests = one.spend ? ` · ${formatCount(one.spend.requests)} requests` : ''
      return [
        BLANK,
        spread(span(`#${String(one.number)} ${one.title}`), cost, width),
        [
          span(one.state.toLowerCase(), STATE_TONE[one.state] ?? 'dim'),
          span(` ${one.branch}${requests}`, 'dim'),
        ],
      ]
    }),
  ]
}
