import type { ModelTotals, Totals } from './cost.ts'
import type { Spend } from './spend.ts'

/** What the analyzer prints and the mod reads. */
export interface Summary {
  generatedAt: string
  pricesFetched: string
  /** The models Anthropic's pricing page lists (the built-in snapshot's when offline). */
  models: string[]
  /** Requests made on the analyzer's local calendar day. */
  today: Totals
  /** Today and the 29 calendar days before it. */
  last30: Totals
  allTime: Totals
  /** Each period's models, most expensive first. */
  byModel: Record<Period, ModelTotals[]>
  /** The most expensive projects of the last 30 days, by working folder. */
  projects: ProjectSpend[]
  /** The repository the session runs in, by branch, all time; null when none was asked for. */
  currentProject: CurrentProject | null
  tips: Tips
  /** The cache lifetime of the latest request that wrote the cache (5 minutes or 1 hour). */
  cacheLifetimeMs: number
  /** Sessions whose main thread made a request in the last 24 hours, most recent first. */
  sessions: RecentSession[]
}

/** A Claude Code session as its main thread (not its subagents) last left it. */
export interface RecentSession {
  /** The title the person gave it, else Claude Code's own; '' when it has none. */
  title: string
  /** The working folder, with the home folder written as ~; '' when the log has none. */
  path: string
  /** The model of the latest request. */
  model: string
  /** When the latest request was logged (ISO 8601). */
  lastAt: string
  /** The latest request's prompt: what the next message sends again. */
  contextTokens: number
  /** How long its cache stays warm after the latest request (5 minutes or 1 hour). */
  cacheLifetimeMs: number
  /** What the next message pays for that context, re-written or read; null when unpriced. */
  next: { cold: number; warm: number } | null
  /** Every request of the session so far, subagents' included. */
  cost: number
  requests: number
}

/** What a skill or MCP server's calls cost: the requests that called it, so shares overlap. */
export interface UseCost {
  name: string
  cost: number
}

export interface Tips {
  last30: {
    cost: number
    /** Requests that re-wrote an expired cache. */
    coldRebuilds: number
    /** What those cost beyond reading a warm cache. */
    coldWaste: number
    /** Cost of requests above LARGE_CONTEXT_TOKENS of prompt. */
    largeContextCost: number
  }
  last24h: { cost: number; largeContextCost: number; skills: UseCost[]; mcpServers: UseCost[] }
}

export interface CurrentProject {
  /** The repository's root folder, with the home folder written as ~. */
  path: string
  /** Most expensive first; '' is work outside any branch. */
  branches: { branch: string; spend: Spend }[]
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

function hasStrings(value: Json, keys: readonly string[]): boolean {
  return keys.every((key) => typeof value[key] === 'string')
}

function isStrings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((one) => typeof one === 'string')
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

function isCurrentProject(value: unknown): value is CurrentProject | null {
  if (value === null) return true
  return (
    isObject(value) &&
    typeof value.path === 'string' &&
    Array.isArray(value.branches) &&
    value.branches.every(
      (one) => isObject(one) && typeof one.branch === 'string' && isSpend(one.spend),
    )
  )
}

function isTotals(value: unknown): value is Totals {
  return (
    hasNumbers(value, ['requests', 'unpricedRequests']) &&
    isObject(value) &&
    isStrings(value.unpricedModels) &&
    hasNumbers(value.tokens, TOKEN_KEYS) &&
    hasNumbers(value.cost, COST_KEYS)
  )
}

function isUseCosts(value: unknown): value is UseCost[] {
  return (
    Array.isArray(value) &&
    value.every(
      (one) => isObject(one) && typeof one.name === 'string' && typeof one.cost === 'number',
    )
  )
}

function isTips(value: unknown): value is Tips {
  if (!isObject(value) || !isObject(value.last24h)) return false
  const day = value.last24h
  return (
    hasNumbers(value.last30, ['cost', 'coldRebuilds', 'coldWaste', 'largeContextCost']) &&
    hasNumbers(day, ['cost', 'largeContextCost']) &&
    isUseCosts(day.skills) &&
    isUseCosts(day.mcpServers)
  )
}

function isNext(value: unknown): boolean {
  return value === null || hasNumbers(value, ['cold', 'warm'])
}

function isSessions(value: unknown): value is RecentSession[] {
  return (
    Array.isArray(value) &&
    value.every(
      (one) =>
        isObject(one) &&
        hasStrings(one, ['title', 'path', 'model', 'lastAt']) &&
        hasNumbers(one, ['contextTokens', 'cacheLifetimeMs', 'cost', 'requests']) &&
        isNext(one.next),
    )
  )
}

function isSummary(value: unknown): value is Summary {
  return (
    isObject(value) &&
    hasStrings(value, ['generatedAt', 'pricesFetched']) &&
    isStrings(value.models) &&
    PERIODS.every((period) => isTotals(value[period])) &&
    isByModel(value.byModel) &&
    isProjects(value.projects) &&
    isCurrentProject(value.currentProject) &&
    isTips(value.tips) &&
    typeof value.cacheLifetimeMs === 'number' &&
    isSessions(value.sessions)
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
  return isSummary(value) ? value : undefined
}
