import { ratesFor } from './pricing.ts'

/** Claude Code sessions write one-hour cache entries unless the logs say otherwise. */
export const DEFAULT_CACHE_LIFETIME_MS = 60 * 60 * 1000

const PER_MILLION = 1_000_000
const FIVE_MINUTES_MS = 5 * 60 * 1000

/** How long the cache stays warm after a request made at `at`; negative once it has expired. */
export function cacheMsLeft(now: number, at: number, lifetimeMs: number): number {
  return lifetimeMs - (now - at)
}

/**
 * What the next message pays for its context: re-written into an expired cache (`cold`),
 * or read from a warm one (`warm`). Undefined for a model with no published price.
 */
export function contextCost(
  model: string,
  promptTokens: number,
  lifetimeMs: number,
): { cold: number; warm: number } | undefined {
  const rates = ratesFor({ model, promptTokens })
  if (rates === undefined) return undefined
  const write = lifetimeMs <= FIVE_MINUTES_MS ? rates.write5m : rates.write1h
  return {
    cold: (promptTokens * write) / PER_MILLION,
    warm: (promptTokens * rates.read) / PER_MILLION,
  }
}
