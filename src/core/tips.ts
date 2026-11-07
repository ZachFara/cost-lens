import { costOf, promptTokens } from './cost.ts'
import type { UsageRecord } from './cost.ts'
import { ratesFor } from './pricing.ts'

/** Above this many prompt tokens a request counts as large context (as `/usage` advises). */
export const LARGE_CONTEXT_TOKENS = 150_000

const COLD_MIN_WRITE_TOKENS = 5000
const PER_MILLION = 1_000_000
export const FIVE_MINUTES_MS = 5 * 60 * 1000
const ONE_HOUR_MS = 60 * 60 * 1000

/** How long the cache this request wrote stays warm: one hour, five minutes, or as before. */
export function cacheLifetimeMs(record: UsageRecord, previous: number): number {
  if (record.usage.cacheWrite1h > 0) return ONE_HOUR_MS
  if (record.usage.cacheWrite5m > 0) return FIVE_MINUTES_MS
  return previous
}

export function isLargeContext(record: UsageRecord): boolean {
  return promptTokens(record.usage) > LARGE_CONTEXT_TOKENS
}

/**
 * What a cold rebuild cost beyond a warm cache: when the gap since the previous request
 * outlived the cache and the request re-wrote at least 5,000 tokens (reading fewer), the
 * writes' cost minus what reading the same tokens would have cost. 0 otherwise.
 */
export function coldRebuildWaste(record: UsageRecord, gapMs: number, lifetimeMs: number): number {
  const { cacheWrite5m, cacheWrite1h, cacheRead } = record.usage
  const written = cacheWrite5m + cacheWrite1h
  if (gapMs <= lifetimeMs || written < COLD_MIN_WRITE_TOKENS || cacheRead >= written) return 0
  const cost = costOf(record)
  const rates = ratesFor({ model: record.model, promptTokens: promptTokens(record.usage) })
  if (cost === undefined || rates === undefined) return 0
  return Math.max(0, cost.cacheWrite - (written * rates.read) / PER_MILLION)
}
