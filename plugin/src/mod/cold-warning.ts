import { cacheMsLeft, contextCost } from '../core/cache.ts'
import { formatTokens, formatUsd } from '../core/format.ts'
import type { PriceTable } from '../core/pricing.ts'
import type { LastRequest } from '../../types'

/** Below this many tokens of context a cold cache costs too little to mention. */
const WARN_FROM_TOKENS = 40_000

/** The main thread's last request, its cache lifetime, and the last summary's prices. */
export interface CacheFacts {
  request: LastRequest | null
  lifetimeMs: number
  /** The built-in snapshot's prices when undefined. */
  prices?: PriceTable | undefined
}

/** The warning for a prompt about to go out over an expired cache, or undefined. */
export function coldCacheWarning(cache: CacheFacts, now: number): string | undefined {
  const { request, lifetimeMs, prices } = cache
  if (request === null || request.promptTokens < WARN_FROM_TOKENS) return undefined
  if (cacheMsLeft(now, request.at, lifetimeMs) > 0) return undefined
  const cost = contextCost(request.model, request.promptTokens, lifetimeMs, prices)
  const price =
    cost === undefined ? '' : ` ≈ ${formatUsd(cost.cold)} instead of ${formatUsd(cost.warm)}`
  return (
    `cost-lens: the cache had expired, so this message re-writes ${formatTokens(request.promptTokens)} tokens${price}. ` +
    'Next time, /compact before a long break or /clear to start fresh.'
  )
}
