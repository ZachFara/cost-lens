import type { EngineInterface } from 'claude-code'

import { cacheMsLeft, contextCost } from '../core/cache.ts'
import { formatTokens, formatUsd } from '../core/format.ts'

import { readCache } from './cache-band.tsx'

/** Below this many tokens of context a cold cache costs too little to mention. */
const WARN_FROM_TOKENS = 40_000

/** The warning for a prompt about to go out over an expired cache, or undefined. */
export async function coldCacheWarning($: EngineInterface): Promise<string | undefined> {
  const { request, lifetimeMs } = await readCache($)
  if (request === null || request.promptTokens < WARN_FROM_TOKENS) return undefined
  if (cacheMsLeft(await $.clock.now(), request.at, lifetimeMs) > 0) return undefined
  const cost = contextCost(request.model, request.promptTokens, lifetimeMs)
  const price =
    cost === undefined ? '' : ` ≈ ${formatUsd(cost.cold)} instead of ${formatUsd(cost.warm)}`
  return (
    `cost-lens: the cache had expired, so this message re-writes ${formatTokens(request.promptTokens)} tokens${price}. ` +
    'Next time, /compact before a long break or /clear to start fresh.'
  )
}
