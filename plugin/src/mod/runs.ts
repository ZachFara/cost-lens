import type { ProcessRunResult } from 'claude-code'

import { DEFAULT_CACHE_LIFETIME_MS } from '../core/cache.ts'
import { parsePullRequests } from '../core/pull-requests.ts'
import { parseSummary } from '../core/summary.ts'
import type { Summary } from '../core/summary.ts'
import type { History, PullRequests } from '../../types'

import type { Ready } from './ui.ts'

/** How long a log read and a `gh pr list` may take. */
export const ANALYZER_TIMEOUT_MS = 5 * 60 * 1000
export const GH_TIMEOUT_MS = 30 * 1000

export type AnalyzerRead = { summary: Summary } | { error: string }

/** The analyzer's `--project` argument: the session's repository when it has one. */
export function projectArgs(project: string | undefined): string[] {
  return project === undefined ? [] : ['--project', project]
}

function firstLine(stderr: string, fallback: string): string {
  const line = stderr.trim().split('\n')[0] ?? ''
  return line === '' ? fallback : line
}

export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** The analyzer's run as a summary, or why there is none. Its output is untrusted. */
export function readAnalyzerRun(run: ProcessRunResult): AnalyzerRead {
  if (run.exitCode !== 0) {
    return { error: firstLine(run.stderr, `the analyzer exited with code ${String(run.exitCode)}`) }
  }
  const summary = parseSummary(run.stdout)
  return summary ? { summary } : { error: 'the analyzer printed something unexpected' }
}

/** `gh pr list`'s run as the PRs tab's state. Its output is untrusted. */
export function readGhRun(run: ProcessRunResult): PullRequests {
  if (run.exitCode !== 0)
    return { status: 'error', message: firstLine(run.stderr, 'gh pr list failed') }
  const prs = parsePullRequests(run.stdout)
  return prs
    ? { status: 'ready', prs }
    : { status: 'error', message: 'gh printed something unexpected' }
}

/** A first read's outcome. */
export function loaded(result: AnalyzerRead): History {
  return 'summary' in result
    ? { status: 'ready', summary: result.summary, isRefreshing: false, refreshError: null }
    : { status: 'error', message: result.error }
}

/** A refresh's outcome: new numbers, or the last ones with the reason the refresh failed. */
export function refreshed(current: Ready, result: AnalyzerRead): History {
  return 'summary' in result
    ? loaded(result)
    : { ...current, isRefreshing: false, refreshError: result.error }
}

/** How long the prompt cache lasts: as the logs last showed, else one hour. */
export function cacheLifetime(history: History): number {
  return history.status === 'ready' ? history.summary.cacheLifetimeMs : DEFAULT_CACHE_LIFETIME_MS
}
