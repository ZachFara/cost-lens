import type { SessionRateLimit } from 'claude-code'

import type { PlanWindow } from '../../types'

/** The windows every subscription has, which `/usage` always shows. */
const PLAN_KINDS = ['five_hour', 'seven_day']

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

/**
 * The plan windows to draw. The engine reports the windows the last response did, so
 * after the session window resets it can drop it, or keep its old reading, and a
 * per-model week can drop out. Windows it dropped show as remembered; on a subscription
 * the session and week windows always show; one past its reset shows empty.
 */
export function planWindows(
  reported: readonly SessionRateLimit[],
  remembered: readonly PlanWindow[],
  now: number,
): SessionRateLimit[] {
  const reportedKinds = new Set(reported.map((window) => window.kind))
  const known = [...reported, ...remembered.filter((one) => !reportedKinds.has(one.kind))]
  const isPlan = known.some((window) => /^(five_hour|seven_day)/.test(window.kind))
  const others = known.map((window) => window.kind).filter((kind) => !PLAN_KINDS.includes(kind))
  return [...(isPlan ? PLAN_KINDS : []), ...others].map((kind) => {
    const window = known.find((one) => one.kind === kind)
    const hasReset = window?.resetsAt !== undefined && Date.parse(window.resetsAt) <= now
    return window === undefined || hasReset ? { kind, percentUsed: 0 } : window
  })
}
