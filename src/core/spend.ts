import { costOf } from './cost.ts'
import type { CostSplit, UsageRecord } from './cost.ts'

/** What a project or branch cost: requests, cost by category, and when it was last used. */
export interface Spend {
  requests: number
  cost: CostSplit
  /** ISO 8601 time of the latest request, or '' when none had a time. */
  lastActive: string
}

export function emptySpend(): Spend {
  return { requests: 0, cost: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }, lastActive: '' }
}

function later(a: string, b: string | undefined): string {
  if (b === undefined || Number.isNaN(Date.parse(b))) return a
  return a === '' || Date.parse(b) > Date.parse(a) ? b : a
}

/** Adds one request, in place; a model with no published price adds a request and no cost. */
export function addSpend(spend: Spend, record: UsageRecord, timestamp: string | undefined): void {
  spend.requests += 1
  spend.lastActive = later(spend.lastActive, timestamp)
  const cost = costOf(record)
  if (cost === undefined) return
  spend.cost.input += cost.input
  spend.cost.output += cost.output
  spend.cost.cacheWrite += cost.cacheWrite
  spend.cost.cacheRead += cost.cacheRead
}
