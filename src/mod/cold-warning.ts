import type { On } from 'claude-code'

import { cacheMsLeft, contextCost } from '../core/cache.ts'
import { formatTokens, formatUsd } from '../core/format.ts'

import { readCache } from './cache-band.tsx'

/** Below this many tokens of context a cold cache costs too little to mention. */
const WARN_FROM_TOKENS = 40_000
const TOAST_MS = 10_000

/**
 * As a prompt typed by the person goes out over an expired cache with a large context,
 * a toast says what re-writing that context costs. It never holds, delays or changes the
 * prompt: the warning is worked out first and shown once the prompt has entered.
 */
export function registerColdWarning(on: On): void {
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.origin.kind !== 'composer') return next(e)
    const { request, lifetimeMs } = await readCache($)
    const now = await $.clock.now()
    const isCold = request !== null && cacheMsLeft(now, request.at, lifetimeMs) <= 0
    const result = await next(e)
    if (!isCold || request.promptTokens < WARN_FROM_TOKENS) return result
    const cost = contextCost(request.model, request.promptTokens, lifetimeMs)
    const price =
      cost === undefined ? '' : ` ≈ ${formatUsd(cost.cold)} instead of ${formatUsd(cost.warm)}`
    $.ui.toast(
      `cost-lens: the cache had expired, so this message re-writes ${formatTokens(request.promptTokens)} tokens${price}. ` +
        'Next time, /compact before a long break or /clear to start fresh.',
      { timeoutMs: TOAST_MS },
    )
    return result
  }).catch((_, e, next) => next(e))
}
