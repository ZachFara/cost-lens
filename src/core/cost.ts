import { ratesFor } from './pricing.ts'

export interface TokenUsage {
  input: number
  output: number
  cacheWrite5m: number
  cacheWrite1h: number
  cacheRead: number
}

export interface UsageRecord {
  model: string
  usage: TokenUsage
  speed?: string | undefined
  geo?: string | undefined
}

export interface CostSplit {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

export interface Totals {
  requests: number
  unpricedRequests: number
  unpricedModels: string[]
  tokens: TokenUsage
  cost: CostSplit
}

const PER_MILLION = 1_000_000

function promptTokens(usage: TokenUsage): number {
  return usage.input + usage.cacheWrite5m + usage.cacheWrite1h + usage.cacheRead
}

/** What one request cost by category, or undefined when its model has no published price. */
export function costOf(record: UsageRecord): CostSplit | undefined {
  const { usage } = record
  const rates = ratesFor({
    model: record.model,
    promptTokens: promptTokens(usage),
    speed: record.speed,
    geo: record.geo,
  })
  if (rates === undefined) return undefined
  return {
    input: (usage.input * rates.input) / PER_MILLION,
    output: (usage.output * rates.output) / PER_MILLION,
    cacheWrite:
      (usage.cacheWrite5m * rates.write5m + usage.cacheWrite1h * rates.write1h) / PER_MILLION,
    cacheRead: (usage.cacheRead * rates.read) / PER_MILLION,
  }
}

export function emptyTotals(): Totals {
  return {
    requests: 0,
    unpricedRequests: 0,
    unpricedModels: [],
    tokens: { input: 0, output: 0, cacheWrite5m: 0, cacheWrite1h: 0, cacheRead: 0 },
    cost: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  }
}

function addTokens(into: TokenUsage, usage: TokenUsage): void {
  into.input += usage.input
  into.output += usage.output
  into.cacheWrite5m += usage.cacheWrite5m
  into.cacheWrite1h += usage.cacheWrite1h
  into.cacheRead += usage.cacheRead
}

/** The totals with one more request, as a new value (for state that must not be mutated). */
export function plusRecord(totals: Totals, record: UsageRecord): Totals {
  const next: Totals = {
    ...totals,
    unpricedModels: [...totals.unpricedModels],
    tokens: { ...totals.tokens },
    cost: { ...totals.cost },
  }
  addRecord(next, record)
  return next
}

/** Adds one request to the totals, in place. */
export function addRecord(totals: Totals, record: UsageRecord): void {
  totals.requests += 1
  addTokens(totals.tokens, record.usage)
  const cost = costOf(record)
  if (cost === undefined) {
    totals.unpricedRequests += 1
    if (!totals.unpricedModels.includes(record.model)) totals.unpricedModels.push(record.model)
    return
  }
  totals.cost.input += cost.input
  totals.cost.output += cost.output
  totals.cost.cacheWrite += cost.cacheWrite
  totals.cost.cacheRead += cost.cacheRead
}

export function totalCost(cost: CostSplit): number {
  return cost.input + cost.output + cost.cacheWrite + cost.cacheRead
}

/** Share of prompt tokens served from the cache, 0 to 1. */
export function cacheHitRate(tokens: TokenUsage): number {
  const prompt = promptTokens(tokens)
  return prompt === 0 ? 0 : tokens.cacheRead / prompt
}

/** One model's share of a period. */
export interface ModelTotals {
  model: string
  requests: number
  /** False for a model with no published price: its cost is 0 and not in the total. */
  isPriced: boolean
  tokens: TokenUsage
  cost: CostSplit
}

/** Adds one request to its model's totals, in place. */
export function addToModel(byModel: Map<string, ModelTotals>, record: UsageRecord): void {
  let totals = byModel.get(record.model)
  if (totals === undefined) {
    const { tokens, cost } = emptyTotals()
    totals = { model: record.model, requests: 0, isPriced: true, tokens, cost }
    byModel.set(record.model, totals)
  }
  totals.requests += 1
  addTokens(totals.tokens, record.usage)
  const cost = costOf(record)
  if (cost === undefined) {
    totals.isPriced = false
    return
  }
  totals.cost.input += cost.input
  totals.cost.output += cost.output
  totals.cost.cacheWrite += cost.cacheWrite
  totals.cost.cacheRead += cost.cacheRead
}

/** Models from most to least expensive; unpriced models (cost 0) by requests after them. */
export function rankModels(byModel: Map<string, ModelTotals>): ModelTotals[] {
  return [...byModel.values()].sort(
    (a, b) => totalCost(b.cost) - totalCost(a.cost) || b.requests - a.requests,
  )
}
