import type { On } from 'claude-code'

import { adviseModel } from './advisor.ts'
import { coldCacheWarning } from './cold-warning.ts'

const TOAST_MS = 10_000

/**
 * The module's one prompt.submit hook (the engine allows one without a matcher). For a
 * prompt the person typed: the cold-cache warning, then the model advice. Neither holds,
 * delays or changes the prompt; both show only after it has entered, and a failure lets
 * the prompt through.
 */
export function registerPromptSubmit(on: On): void {
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined || e.origin.kind !== 'composer') return next(e)
    const warning = await coldCacheWarning($)
    const result = await next(e)
    if (warning !== undefined) $.ui.toast(warning, { timeoutMs: TOAST_MS })
    await adviseModel($, e.text)
    return result
  }).catch((_, e, next) => next(e))
}
