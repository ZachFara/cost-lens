/**
 * The plan's usage windows (`/usage`): how they are named and drawn, and the reading the
 * mod saves for the terminal view, which has no Claude Code session to ask.
 */

/** A usage window as a response reported it. */
export interface PlanLimit {
  kind: string
  percentUsed: number
  resetsAt?: string
}

/** The windows a Claude Code session last reported, and when (in milliseconds). */
export interface PlanReading {
  at: number
  windows: PlanLimit[]
}

/** The windows every subscription has, which `/usage` always shows. */
const PLAN_KINDS = ['five_hour', 'seven_day']

/** The file the mod saves the last reading to, under the person's home folder. */
export function planFile(home: string): string {
  return `${home}/Library/Caches/cost-lens/plan.json`
}

/** The windows `/usage` shows, by the names the API reports them under. */
export function limitLabel(kind: string): string {
  if (kind === 'five_hour') return 'Current session'
  if (kind === 'seven_day') return 'Current week (all models)'
  if (kind === 'spend_limit') return 'Spend limit'
  const model = /^seven_day_(.+)$/.exec(kind)?.[1]
  if (model !== undefined) return `Current week (${model[0]?.toUpperCase() ?? ''}${model.slice(1)})`
  return kind
}

export function limitTone(percent: number): 'success' | 'warning' | 'error' {
  if (percent >= 80) return 'error'
  return percent >= 50 ? 'warning' : 'success'
}

/**
 * The plan windows to draw. The engine reports the windows the last response did, so
 * after the session window resets it can drop it, or keep its old reading, and a
 * per-model week can drop out. Windows it dropped show as remembered; on a subscription
 * the session and week windows always show; one past its reset shows empty.
 */
export function planWindows(
  reported: readonly PlanLimit[],
  remembered: readonly PlanLimit[],
  now: number,
): PlanLimit[] {
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

function isLimit(value: unknown): value is PlanLimit {
  if (typeof value !== 'object' || value === null) return false
  const { kind, percentUsed, resetsAt } = value as Record<string, unknown>
  const hasReset = resetsAt === undefined || typeof resetsAt === 'string'
  return typeof kind === 'string' && Number.isFinite(percentUsed) && hasReset
}

/** A saved reading, read back as untrusted data; undefined when it is not one. */
export function parsePlan(text: string): PlanReading | undefined {
  try {
    const value = JSON.parse(text) as Partial<PlanReading> | null
    if (typeof value?.at !== 'number' || !Array.isArray(value.windows)) return undefined
    return { at: value.at, windows: (value.windows as unknown[]).filter(isLimit) }
  } catch {
    return undefined
  }
}
