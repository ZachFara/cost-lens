import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import { emptyTotals, plusRecord, promptTokens } from '../core/cost.ts'
import type { UsageRecord } from '../core/cost.ts'
import type { SummaryTotals } from '../../types'

import { recordMainRequest } from './cache-band.tsx'

// Change the tag when the totals' fields change: it declines what an earlier version stored.
const live = atom({ plugin: 'cost-lens', key: 'live' } as const, emptyTotals(), {
  shape: 'live-1',
})

interface StepUsage {
  model: string
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens: number
  cache_creation_input_tokens: number
}

/**
 * One request's usage as the engine reports it. The engine does not say which cache
 * lifetime a write used; Claude Code sessions write one-hour entries, so writes are
 * priced as those.
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

/** This session's requests so far, main loop and subagents. */
export function readLive($: EngineInterface): Promise<SummaryTotals> {
  return read($, live)
}

/** Counts every model request of the session as its response completes. */
export function registerLive(on: On): void {
  on('turn.step', async function* ($, e, next) {
    const result = yield* next(e)
    const usage = result.usage
    if (usage === null) return result
    const record = stepRecord(usage)
    await update($, live, (totals) => plusRecord(totals, record))
    if (e.agentId === undefined) {
      const at = await $.clock.now()
      await recordMainRequest($, {
        at,
        model: usage.model,
        promptTokens: promptTokens(record.usage),
      })
    }
    return result
  })
}
