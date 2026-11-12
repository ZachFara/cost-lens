import { emptyTotals, plusRecord, promptTokens } from '../core/cost.ts'
import type { Totals, UsageRecord } from '../core/cost.ts'
import type { PriceTable } from '../core/pricing.ts'

/** A model request's usage as the engine reports it on `turn.step`. */
interface StepUsage {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/**
 * One request's usage as a record. The engine does not say which cache lifetime a write
 * used; Claude Code sessions write one-hour entries, so writes are priced as those.
 */
function stepRecord(usage: StepUsage): UsageRecord {
  return {
    model: usage.model,
    usage: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      cacheWrite5m: 0,
      cacheWrite1h: usage.cache_creation_input_tokens,
      cacheRead: usage.cache_read_input_tokens,
    },
  }
}

/** The session before its first request. */
export const NO_REQUESTS: Totals = emptyTotals()

/** The session's totals with one more request, at the last summary's prices if given. */
export function addStep(totals: Totals, usage: StepUsage, prices?: PriceTable): Totals {
  return plusRecord(totals, stepRecord(usage), prices)
}

/** The request's whole prompt: what the next message builds on. */
export function stepPromptTokens(usage: StepUsage): number {
  return promptTokens(stepRecord(usage).usage)
}
