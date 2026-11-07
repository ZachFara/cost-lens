import type { ModelTotals, Totals } from './cost.ts'
import type { Spend } from './spend.ts'

/** What the analyzer prints and the mod reads. */
export interface Summary {
  generatedAt: string
  pricesFetched: string
  /** Requests made on the analyzer's local calendar day. */
  today: Totals
  /** Today and the 29 calendar days before it. */
  last30: Totals
  allTime: Totals
  /** Each period's models, most expensive first. */
  byModel: Record<Period, ModelTotals[]>
  /** The most expensive projects of the last 30 days, by working folder. */
  projects: ProjectSpend[]
}

export interface ProjectSpend {
  /** The session's working folder, with the home folder written as ~. */
  path: string
  last30: Spend
}

export type Period = 'today' | 'last30' | 'allTime'

const PERIODS: readonly Period[] = ['today', 'last30', 'allTime']

type Json = Record<string, unknown>

function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasNumbers(value: unknown, keys: readonly string[]): boolean {
  return isObject(value) && keys.every((key) => typeof value[key] === 'number')
}

const TOKEN_KEYS = ['input', 'output', 'cacheWrite5m', 'cacheWrite1h', 'cacheRead'] as const
const COST_KEYS = ['input', 'output', 'cacheWrite', 'cacheRead'] as const

function isModelTotals(value: unknown): value is ModelTotals {
  return (
    isObject(value) &&
    typeof value.model === 'string' &&
    typeof value.requests === 'number' &&
    typeof value.isPriced === 'boolean' &&
    hasNumbers(value.tokens, TOKEN_KEYS) &&
    hasNumbers(value.cost, COST_KEYS)
  )
}

function isByModel(value: unknown): value is Record<Period, ModelTotals[]> {
  return (
    isObject(value) &&
    PERIODS.every((period) => {
      const models = value[period]
      return Array.isArray(models) && models.every(isModelTotals)
    })
  )
}

function isSpend(value: unknown): value is Spend {
  return (
    isObject(value) &&
    typeof value.requests === 'number' &&
    typeof value.lastActive === 'string' &&
    hasNumbers(value.cost, COST_KEYS)
  )
}

function isProjects(value: unknown): value is ProjectSpend[] {
  return (
    Array.isArray(value) &&
    value.every((one) => isObject(one) && typeof one.path === 'string' && isSpend(one.last30))
  )
}

function isTotals(value: unknown): value is Totals {
  return (
    hasNumbers(value, ['requests', 'unpricedRequests']) &&
    isObject(value) &&
    Array.isArray(value.unpricedModels) &&
    value.unpricedModels.every((model) => typeof model === 'string') &&
    hasNumbers(value.tokens, TOKEN_KEYS) &&
    hasNumbers(value.cost, COST_KEYS)
  )
}

/** Reads the analyzer's output; anything that is not a well-formed summary is rejected. */
export function parseSummary(text: string): Summary | undefined {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return undefined
  }
  if (!isObject(value)) return undefined
  const { generatedAt, pricesFetched, today, last30, allTime, byModel, projects } = value
  if (typeof generatedAt !== 'string' || typeof pricesFetched !== 'string') return undefined
  if (!isTotals(today) || !isTotals(last30) || !isTotals(allTime)) return undefined
  if (!isByModel(byModel) || !isProjects(projects)) return undefined
  return { generatedAt, pricesFetched, today, last30, allTime, byModel, projects }
}
