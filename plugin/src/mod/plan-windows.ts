import type { SessionRateLimit } from 'claude-code'

import { planWindows } from '../core/plan.ts'
import type { PlanWindow } from '../../types'

/** How long the analyzer may take to save a reading. */
export const SAVE_TIMEOUT_MS = 10_000

/**
 * The windows to remember: the last reading of each that has a reset time, so one the
 * engine stops reporting (a per-model week) still shows until it resets.
 */
export function rememberWindows(
  known: readonly PlanWindow[],
  reported: readonly SessionRateLimit[],
): PlanWindow[] {
  const byKind = new Map(known.map((window) => [window.kind, window]))
  for (const window of reported) {
    if (window.resetsAt === undefined) continue
    const { kind, percentUsed, resetsAt } = window
    byKind.set(kind, { kind, percentUsed, resetsAt })
  }
  return [...byKind.values()]
}

/** The reading the terminal view shows, as the analyzer's `--save-plan` takes it. */
export function planJson(
  reported: readonly SessionRateLimit[],
  remembered: readonly PlanWindow[],
  at: number,
): string {
  const windows = planWindows(reported, remembered, at).map(({ kind, percentUsed, resetsAt }) =>
    resetsAt === undefined ? { kind, percentUsed } : { kind, percentUsed, resetsAt },
  )
  return JSON.stringify({ at, windows })
}
